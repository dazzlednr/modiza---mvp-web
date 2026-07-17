import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyCommunities } from "@/repositories/communityRepository";
import {
  createSpaceUseRequest,
  getRequestsForCommunityOwner,
  getRequestsForSpaceOwner,
  getSpaceUseRequest,
} from "@/repositories/spaceUseRequestRepository";

const createSchema = z.object({
  spaceId: z.string().uuid(),
  communityId: z.string().uuid(),
  purpose: z.string().trim().min(2).max(500),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  requestedEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  expectedAttendees: z.number().int().min(1).max(10000),
  message: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
});

function failed(error: unknown, fallback: string) {
  const status = apiAuthStatus(error) ?? 500;
  const value = error as { code?: string; message?: string };
  const known: Record<string, string> = {
    COMMUNITY_NOT_FOUND: "운영 중인 커뮤니티를 다시 선택해 주세요.",
    SPACE_NOT_AVAILABLE: "현재 이용 요청을 보낼 수 없는 공간이에요.",
    OWN_SPACE_REQUEST_NOT_ALLOWED: "본인이 운영하는 공간에는 이용 요청을 보낼 수 없어요.",
    INVALID_ATTENDEE_COUNT: "공간의 최대 수용 인원에 맞게 인원을 입력해 주세요.",
    INVALID_REQUEST_TIME: "종료 시간은 시작 시간보다 뒤로 설정해 주세요.",
  };
  const message = known[value.message ?? ""] ?? (status === 500 ? fallback : value.message) ?? fallback;
  if (status === 500) console.error("[MODIZA][space-use-request]", error);
  return NextResponse.json({ message }, { status: known[value.message ?? ""] ? 400 : status });
}

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope") ?? "requested";
    if (scope === "context") {
      const { supabase } = await requireApiUser("community_host");
      return NextResponse.json({ communities: await getMyCommunities(supabase) });
    }
    if (scope === "owned") {
      const { user } = await requireApiUser("space_host");
      return NextResponse.json(await getRequestsForSpaceOwner(createAdminSupabaseClient(), user.id));
    }
    const { user } = await requireApiUser("community_host");
    return NextResponse.json(await getRequestsForCommunityOwner(createAdminSupabaseClient(), user.id));
  } catch (error) {
    return failed(error, "공간 이용 요청을 불러오지 못했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser("community_host");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "이용 요청 정보를 확인해 주세요." }, { status: 400 });
    if (parsed.data.requestedEndTime <= parsed.data.requestedStartTime) return NextResponse.json({ message: "종료 시간은 시작 시간보다 뒤로 설정해 주세요." }, { status: 400 });
    await createSpaceUseRequest(supabase, parsed.data);
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.from("space_use_requests").select("id").eq("idempotency_key", parsed.data.idempotencyKey).single();
    if (error) throw error;
    const saved = await getSpaceUseRequest(admin, data.id, user.id);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return failed(error, "공간 이용 요청을 보내지 못했어요.");
  }
}
