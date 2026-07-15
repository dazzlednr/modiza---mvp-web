import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { updateApplicationStatusAsOwner } from "@/repositories/applicationRepository";
import type { ApplicationStatus } from "@/types/community";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const body = await request.json() as { status: ApplicationStatus; operatorMemo?: string | null };
    if (!(["pending", "approved", "rejected"] as string[]).includes(body.status)) return NextResponse.json({ message: "상태를 확인해 주세요." }, { status: 400 });
    await updateApplicationStatusAsOwner(supabase, (await params).id, body.status, body.operatorMemo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    if (error instanceof Error && error.message === "CAPACITY_FULL") return NextResponse.json({ message: "모집 정원을 초과해 승인할 수 없어요." }, { status: 409 });
    return NextResponse.json({ message: "신청 상태를 변경하지 못했어요." }, { status: 400 });
  }
}
