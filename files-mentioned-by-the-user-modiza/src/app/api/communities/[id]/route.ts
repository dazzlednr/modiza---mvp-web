import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import {
  changeCommunityStatus,
  changeRecruitmentStatus,
  deleteCommunity,
  getCommunityByIdForDashboard,
  updateCommunity,
  uploadCommunityThumbnail,
  uploadCommunityActivityImages,
} from "@/repositories/communityRepository";
import { syncInitialCommunitySchedule } from "@/repositories/scheduleRepository";
import { getSpaceById } from "@/repositories/spaceRepository";
import { CommunityFormSchema } from "@/types/community";

const allowed = ["image/jpeg", "image/png", "image/webp"];

function koreanTimestamp(value?: string | null) {
  if (!value) return value;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  return `${value}${value.length === 16 ? ":00" : ""}+09:00`;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = (await requireApiUser("community_host")).supabase;
    const community = await getCommunityByIdForDashboard(
      db,
      (await params).id,
    );
    return community
      ? NextResponse.json(community)
      : NextResponse.json({ message: "커뮤니티를 찾을 수 없어요." }, { status: 404 });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    return NextResponse.json({ message: "커뮤니티를 불러오지 못했어요." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = (await requireApiUser("community_host")).supabase;
    const id = (await params).id;
    const form = await request.formData();
    const parsed = CommunityFormSchema.safeParse(JSON.parse(String(form.get("values"))));
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "입력하지 않은 항목을 확인해 주세요.",
          fieldErrors: Object.fromEntries(parsed.error.issues.filter((issue) => issue.path[0]).map((issue) => [String(issue.path[0]), issue.message])),
        },
        { status: 400 },
      );
    }
    const values = {
      ...parsed.data,
      nextMeetingAt: koreanTimestamp(parsed.data.nextMeetingAt)!,
      meetingEndAt: koreanTimestamp(parsed.data.meetingEndAt),
      recruitmentStatus: "recruiting" as const,
      recruitmentStartAt: new Date().toISOString(),
      recruitmentEndAt: new Date(new Date(koreanTimestamp(parsed.data.nextMeetingAt)!).getTime() - 60 * 60 * 1000).toISOString(),
    };
    if (values.detailedRegion === "기타" && !values.customRegion?.trim()) return NextResponse.json({ message: "기타 지역명을 입력해 주세요." }, { status: 400 });
    if (new Date(values.nextMeetingAt).getTime() < Date.now() + 60 * 60 * 1000) return NextResponse.json({ message: "모임 시작은 현재부터 1시간보다 뒤로 설정해 주세요." }, { status: 400 });
    const current = await getCommunityByIdForDashboard(db, id);
    if (!current) return NextResponse.json({ message: "커뮤니티를 찾을 수 없어요." }, { status: 404 });

    const space = values.linkedSpaceId
      ? await getSpaceById(db, values.linkedSpaceId)
      : null;
    if (values.linkedSpaceId && (!space || space.status !== "approved")) {
      return NextResponse.json({ message: "선택한 공간을 사용할 수 없어요." }, { status: 400 });
    }
    if (space && values.capacity > space.maxCapacity) {
      return NextResponse.json({ message: "선택한 공간의 수용 인원을 초과했어요." }, { status: 400 });
    }
    const image = form.get("thumbnail");
    const activityImages = form.getAll("activityImages").filter((item): item is File => item instanceof File && item.size > 0);
    if (activityImages.length > 8 || activityImages.some((item) => !allowed.includes(item.type) || item.size > 5_242_880)) return NextResponse.json({ message: "활동 사진은 최대 8장, 장당 5MB 이하로 선택해 주세요." }, { status: 400 });
    if (
      image instanceof File &&
      image.size &&
      (!allowed.includes(image.type) || image.size > 5_242_880)
    ) {
      return NextResponse.json(
        { message: "대표 이미지는 JPG, PNG, WebP 형식의 5MB 이하 파일만 가능해요." },
        { status: 400 },
      );
    }
    await updateCommunity(db, id, values);
    if (image instanceof File && image.size) await uploadCommunityThumbnail(db, id, image);
    if (activityImages.length) await uploadCommunityActivityImages(db, id, activityImages);
    if (current.status === "published") {
      await syncInitialCommunitySchedule(db, {
        communityId: id,
        communityName: values.name,
        nextMeetingAt: values.nextMeetingAt,
        meetingEndAt: values.meetingEndAt,
        location: space?.address ?? `${values.mainRegion} ${values.detailedRegion}`,
        capacity: values.capacity,
      });
    }
    return NextResponse.json(await getCommunityByIdForDashboard(db, id));
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    console.error("[MODIZA][community] update failed", error);
    return NextResponse.json({ message: "커뮤니티를 저장하지 못했어요." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = (await requireApiUser("community_host")).supabase;
    const id = (await params).id;
    const { status, recruitmentStatus } = await request.json();
    let scheduleWarning: string | undefined;
    if (status) {
      await changeCommunityStatus(db, id, status);
      if (status === "published") {
        const community = await getCommunityByIdForDashboard(db, id);
        if (community) {
          const space = community.linkedSpaceId
            ? await getSpaceById(db, community.linkedSpaceId)
            : null;
          try {
            await syncInitialCommunitySchedule(db, {
              communityId: id,
              communityName: community.name,
              nextMeetingAt: community.nextMeetingAt!,
              meetingEndAt: community.meetingEndAt,
              location: space?.address ?? `${community.mainRegion} ${community.detailedRegion}`,
              capacity: community.capacity,
            });
          } catch (scheduleError) {
            console.error("[MODIZA][community] publish schedule failed", scheduleError);
            scheduleWarning = "커뮤니티는 공개됐지만 첫 일정은 저장하지 못했어요. 대시보드에서 다시 추가해 주세요.";
          }
        }
      }
    }
    if (recruitmentStatus) await changeRecruitmentStatus(db, id, recruitmentStatus);
    return NextResponse.json({ ok: true, scheduleWarning });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    const code = error instanceof Error ? error.message : "";
    const message = code === "SPACE_CAPACITY_EXCEEDED"
      ? "선택한 공간의 수용 인원을 초과했어요."
      : code === "PUBLISH_VALIDATION_FAILED"
        ? "공개 전에 모든 필수 정보와 대표 이미지를 등록해 주세요."
        : "상태를 변경하지 못했어요.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = (await requireApiUser("community_host")).supabase;
    await deleteCommunity(
      db,
      (await params).id,
      new URL(request.url).searchParams.get("hard") === "true",
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    return NextResponse.json({ message: "커뮤니티를 삭제하지 못했어요." }, { status: 500 });
  }
}
