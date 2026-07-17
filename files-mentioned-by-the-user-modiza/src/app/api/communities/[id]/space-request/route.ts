import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCommunityByIdForDashboard } from "@/repositories/communityRepository";
import { getSpaceById } from "@/repositories/spaceRepository";
import {
  createSpaceUseRequest,
  getSpaceUseRequest,
} from "@/repositories/spaceUseRequestRepository";

const bodySchema = z.object({ spaceId: z.string().uuid() });

function timeInKorea(value: Date) {
  return value.toLocaleTimeString("sv-SE", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await requireApiUser("community_host");
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "선택한 공간을 확인해주세요." }, { status: 400 });
    }

    const communityId = (await params).id;
    const [community, space] = await Promise.all([
      getCommunityByIdForDashboard(supabase, communityId),
      getSpaceById(supabase, parsed.data.spaceId),
    ]);
    if (!community) {
      return NextResponse.json({ message: "운영 중인 커뮤니티를 찾을 수 없어요." }, { status: 404 });
    }
    if (!space || space.status !== "approved") {
      return NextResponse.json({ message: "현재 신청할 수 없는 공간이에요." }, { status: 400 });
    }
    if (!community.nextMeetingAt) {
      return NextResponse.json({ message: "커뮤니티의 다음 모임 일정을 먼저 등록해주세요." }, { status: 400 });
    }
    if (community.capacity > space.maxCapacity) {
      return NextResponse.json({ message: `이 공간은 최대 ${space.maxCapacity}명까지 이용할 수 있어요.` }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: existing, error: existingError } = await admin.from("space_use_requests")
      .select("id")
      .eq("requester_id", user.id)
      .eq("community_id", community.id)
      .eq("space_id", space.id)
      .in("status", ["pending", "negotiating"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(await getSpaceUseRequest(admin, existing.id, user.id));
    }

    const start = new Date(community.nextMeetingAt);
    const end = community.meetingEndAt
      ? new Date(community.meetingEndAt)
      : new Date(start.getTime() + community.expectedDurationHours * 60 * 60 * 1000);
    const idempotencyKey = crypto.randomUUID();
    await createSpaceUseRequest(supabase, {
      spaceId: space.id,
      communityId: community.id,
      purpose: community.activityDescription || community.shortDescription,
      requestedDate: start.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
      requestedStartTime: timeInKorea(start),
      requestedEndTime: timeInKorea(end),
      expectedAttendees: community.capacity,
      message: `${community.name} 모임의 공간 이용을 신청합니다.`,
      idempotencyKey,
    });

    const { data: saved, error } = await admin.from("space_use_requests")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .single();
    if (error) throw error;
    return NextResponse.json(await getSpaceUseRequest(admin, saved.id, user.id), { status: 201 });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    const value = error as { message?: string };
    if (status === 500) console.error("[MODIZA][community-space-request]", error);
    return NextResponse.json(
      { message: status === 500 ? "공간 신청을 만들지 못했어요. 잠시 후 다시 시도해주세요." : value.message },
      { status },
    );
  }
}
