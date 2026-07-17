import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  confirmSpaceUseRequest,
  getSpaceUseRequest,
  respondToSpaceUseRequest,
  updateSpaceUseRequestMemo,
} from "@/repositories/spaceUseRequestRepository";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), ownerMemo: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("negotiate"), ownerMemo: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("reject"), ownerMemo: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("memo"), ownerMemo: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("confirm") }),
]);

function failed(error: unknown) {
  const status = apiAuthStatus(error) ?? 500;
  const value = error as { message?: string };
  const known: Record<string, string> = {
    REQUEST_NOT_FOUND: "이용 요청을 찾을 수 없어요.",
    REQUEST_ALREADY_PROCESSED: "이미 처리된 요청이에요.",
    RESERVATION_TIME_CONFLICT: "해당 시간에는 이미 확정된 예약이 있습니다. 일정을 확인해주세요.",
    APPROVAL_REQUIRED: "공간 운영자의 승인이 먼저 필요해요.",
    FORBIDDEN: "이 요청을 처리할 권한이 없어요.",
  };
  if (status === 500 && !known[value.message ?? ""]) console.error("[MODIZA][space-use-request-detail]", error);
  return NextResponse.json(
    { message: known[value.message ?? ""] ?? (status === 500 ? "이용 요청을 처리하지 못했어요." : value.message) },
    { status: known[value.message ?? ""] ? (value.message === "REQUEST_NOT_FOUND" ? 404 : 409) : status },
  );
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireApiUser();
    const item = await getSpaceUseRequest(createAdminSupabaseClient(), (await params).id, user.id);
    return item ? NextResponse.json(item) : NextResponse.json({ message: "이용 요청을 찾을 수 없어요." }, { status: 404 });
  } catch (error) {
    return failed(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "처리 내용을 확인해 주세요." }, { status: 400 });
    const id = (await params).id;
    if (parsed.data.action === "confirm") {
      const { supabase, user } = await requireApiUser("community_host");
      await confirmSpaceUseRequest(supabase, id);
      return NextResponse.json(await getSpaceUseRequest(createAdminSupabaseClient(), id, user.id));
    }
    const { supabase, user } = await requireApiUser("space_host");
    if (parsed.data.action === "memo") {
      await updateSpaceUseRequestMemo(supabase, id, parsed.data.ownerMemo);
      return NextResponse.json(await getSpaceUseRequest(createAdminSupabaseClient(), id, user.id));
    }
    await respondToSpaceUseRequest(
      supabase,
      id,
      parsed.data.action === "approve"
        ? "approved"
        : parsed.data.action === "negotiate"
          ? "negotiating"
          : "rejected",
      parsed.data.ownerMemo,
    );
    return NextResponse.json(await getSpaceUseRequest(createAdminSupabaseClient(), id, user.id));
  } catch (error) {
    return failed(error);
  }
}
