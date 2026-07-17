import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import {
  createCommunity,
  getCommunitiesForDashboard,
  getCommunityByIdForDashboard,
  uploadCommunityThumbnail,
  uploadCommunityActivityImages,
} from "@/repositories/communityRepository";
import { createInitialCommunitySchedule } from "@/repositories/scheduleRepository";
import { getApplicationsForMyCommunities } from "@/repositories/applicationRepository";
import { getSpaceById } from "@/repositories/spaceRepository";
import { createSpaceUseRequest, getLatestRequestByCommunity } from "@/repositories/spaceUseRequestRepository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { CommunityFormSchema, type CommunityFormValues } from "@/types/community";
import { PRIMARY_REGION } from "@/constants/taxonomy";

const draftSchema = CommunityFormSchema.partial().extend({
  name: z.string().trim().min(1),
});
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

function koreanTimestamp(value?: string | null) {
  if (!value) return value;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  return `${value}${value.length === 16 ? ":00" : ""}+09:00`;
}

function normalizeDates(values: CommunityFormValues): CommunityFormValues {
  const meetingStart = new Date(koreanTimestamp(values.nextMeetingAt)!);
  return {
    ...values,
    nextMeetingAt: koreanTimestamp(values.nextMeetingAt)!,
    meetingEndAt: koreanTimestamp(values.meetingEndAt),
    recruitmentStatus: "recruiting",
    recruitmentStartAt: new Date().toISOString(),
    recruitmentEndAt: new Date(meetingStart.getTime() - 60 * 60 * 1000).toISOString(),
  };
}

function logDatabaseError(stage: string, error: unknown) {
  const value = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    constraint?: string;
  };
  console.error(`[MODIZA][community] ${stage}`, {
    code: value?.code,
    constraint: value?.constraint,
    message: value?.message ?? String(error),
    details: value?.details,
    hint: value?.hint,
  });
}

function localDebug(error: unknown) {
  if (process.env.VERCEL_ENV === "production") return {};
  const value = error as { code?: string; message?: string; details?: string; hint?: string };
  return {
    debug: {
      code: value?.code ?? "UNKNOWN",
      message: value?.message ?? String(error),
      details: value?.details,
      hint: value?.hint,
    },
  };
}

function localDebugSuffix(error: unknown) {
  if (process.env.VERCEL_ENV === "production") return "";
  const value = error as { code?: string; message?: string };
  return ` [${value?.code ?? "UNKNOWN"}] ${value?.message ?? String(error)}`;
}

export async function GET() {
  try {
    const { supabase, user } = await requireApiUser("community_host");
    const [communities, applications, placeRequests] = await Promise.all([
      getCommunitiesForDashboard(supabase),
      getApplicationsForMyCommunities(supabase),
      getLatestRequestByCommunity(createAdminSupabaseClient(), user.id),
    ]);
    const pendingCounts = new Map<string, number>();
    for (const application of applications) if (application.status === "pending") pendingCounts.set(application.communityId, (pendingCounts.get(application.communityId) ?? 0) + 1);
    return NextResponse.json(communities.map((community) => ({
      ...community,
      pendingApplicationCount: pendingCounts.get(community.id) ?? 0,
      placeRequest: placeRequests.get(community.id) ?? null,
    })));
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    logDatabaseError("list failed", error);
    return NextResponse.json(
      { message: "커뮤니티 목록을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let db: SupabaseClient | null = null;
  let createdId: string | undefined;
  let uploadedPath: string | undefined;

  try {
    db = (await requireApiUser("community_host")).supabase;
    const form = await request.formData();
    const requestedSpaceValue = String(form.get("requestedSpaceId") ?? "").trim();
    const requestedSpaceId = requestedSpaceValue
      ? z.string().uuid().parse(requestedSpaceValue)
      : null;
    const status = String(form.get("status"));
    if (status !== "draft" && status !== "published") {
      return NextResponse.json(
        { message: "저장 상태를 확인해 주세요." },
        { status: 400 },
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("values")));
    } catch {
      return NextResponse.json(
        { message: "입력 내용을 읽지 못했어요. 다시 시도해 주세요." },
        { status: 400 },
      );
    }

    const parsed = (status === "draft" ? draftSchema : CommunityFormSchema).safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        parsed.error.issues
          .filter((issue) => issue.path[0])
          .map((issue) => [String(issue.path[0]), issue.message]),
      );
      return NextResponse.json(
        { message: "입력하지 않은 항목을 확인해 주세요.", fieldErrors },
        { status: 400 },
      );
    }

    const values = normalizeDates(CommunityFormSchema.parse({
      category: "취미",
      shortDescription: "작성 중인 커뮤니티입니다.",
      description: "작성 중인 커뮤니티입니다.",
      mainRegion: PRIMARY_REGION,
      detailedRegion: "기타",
      customRegion: "작성 중",
      nextMeetingAt: new Date(Date.now() + 86_400_000).toISOString(),
      capacity: 1,
      participationFee: 0,
      participationType: "offline",
      recruitmentStatus: "upcoming",
      applicationQuestions: [],
      tags: [],
      ...parsed.data,
    }));
    if (status === "published" && values.detailedRegion === "기타" && !values.customRegion?.trim()) return NextResponse.json({ message: "기타 지역명을 입력해 주세요.", fieldErrors: { customRegion: "기타 지역명을 입력해 주세요." } }, { status: 400 });
    if (status === "published" && new Date(values.nextMeetingAt).getTime() < Date.now() + 60 * 60 * 1000) return NextResponse.json({ message: "모임 시작은 현재부터 1시간보다 뒤로 설정해 주세요.", fieldErrors: { nextMeetingAt: "미래 일시를 선택해 주세요." } }, { status: 400 });

    const selectedSpaceId = requestedSpaceId ?? values.linkedSpaceId ?? null;
    const space = selectedSpaceId
      ? await getSpaceById(db, selectedSpaceId)
      : null;
    if (selectedSpaceId && (!space || space.status !== "approved")) {
      return NextResponse.json(
        { message: "선택한 공간을 사용할 수 없어요.", fieldErrors: { linkedSpaceId: "사용 가능한 공간을 다시 선택해 주세요." } },
        { status: 400 },
      );
    }
    if (space && values.capacity > space.maxCapacity) {
      return NextResponse.json(
        { message: "선택한 공간의 수용 인원을 초과했어요.", fieldErrors: { linkedSpaceId: `최대 ${space.maxCapacity}명까지 이용할 수 있어요.` } },
        { status: 400 },
      );
    }

    const image = form.get("thumbnail");
    const activityImages = form.getAll("activityImages").filter((item): item is File => item instanceof File && item.size > 0);
    if (activityImages.length > 8 || activityImages.some((item) => !allowedImageTypes.includes(item.type) || item.size > 5_242_880)) {
      return NextResponse.json({ message: "활동 사진은 JPG, PNG, WebP 형식으로 최대 8장, 장당 5MB 이하만 등록할 수 있어요." }, { status: 400 });
    }
    if (
      image instanceof File &&
      image.size &&
      (!allowedImageTypes.includes(image.type) || image.size > 5_242_880)
    ) {
      return NextResponse.json(
        { message: "대표 이미지는 JPG, PNG, WebP 형식의 5MB 이하 파일만 가능해요.", fieldErrors: { thumbnail: "JPG, PNG, WebP 형식의 5MB 이하 파일을 선택해 주세요." } },
        { status: 400 },
      );
    }

    const community = await createCommunity(db, values, status);
    createdId = community.id;

    if (image instanceof File && image.size) {
      const upload = await uploadCommunityThumbnail(db, community.id, image);
      uploadedPath = upload.path;
    }
    if (activityImages.length) await uploadCommunityActivityImages(db, community.id, activityImages);

    let scheduleWarning: string | undefined;
    if (status === "published") {
      try {
        await createInitialCommunitySchedule(db, {
          communityId: community.id,
          communityName: community.name,
          nextMeetingAt: values.nextMeetingAt,
          meetingEndAt: values.meetingEndAt,
          location: space?.address ?? `${values.mainRegion} ${values.detailedRegion}`,
          capacity: values.capacity,
        });
      } catch (error) {
        logDatabaseError("initial schedule failed", error);
        scheduleWarning = "커뮤니티는 등록됐지만 첫 일정은 저장하지 못했어요. 대시보드에서 다시 추가해 주세요.";
      }
    }

    let spaceRequestCreated = false;
    if (status === "published" && requestedSpaceId && space) {
      const start = new Date(values.nextMeetingAt);
      const end = values.meetingEndAt
        ? new Date(values.meetingEndAt)
        : new Date(start.getTime() + values.expectedDurationHours * 60 * 60 * 1000);
      const formatTime = (value: Date) => value.toLocaleTimeString("sv-SE", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      await createSpaceUseRequest(db, {
        spaceId: requestedSpaceId,
        communityId: community.id,
        purpose: values.activityDescription || values.shortDescription,
        requestedDate: start.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
        requestedStartTime: formatTime(start),
        requestedEndTime: formatTime(end),
        expectedAttendees: values.capacity,
        message: `${community.name} 모임의 공간 이용을 신청합니다.`,
        idempotencyKey: crypto.randomUUID(),
      });
      spaceRequestCreated = true;
    }

    const saved = await getCommunityByIdForDashboard(db, community.id);
    if (!saved) throw new Error("CREATED_COMMUNITY_NOT_FOUND");
    return NextResponse.json({ ...saved, scheduleWarning, spaceRequestCreated }, { status: 201 });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    logDatabaseError("create failed", error);
    if (uploadedPath && db) {
      const cleanup = await db.storage.from("community-images").remove([uploadedPath]);
      if (cleanup.error) logDatabaseError("upload cleanup failed", cleanup.error);
    }
    if (createdId && db) {
      const cleanup = await db.from("communities").delete().eq("id", createdId);
      if (cleanup.error) logDatabaseError("row cleanup failed", cleanup.error);
    }
    return NextResponse.json(
      {
        message: `커뮤니티를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.${localDebugSuffix(error)}`,
        ...localDebug(error),
      },
      { status: 500 },
    );
  }
}
