import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { cancelMyApplication } from "@/repositories/applicationRepository";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser();
    await cancelMyApplication(supabase, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 400;
    return NextResponse.json({ message: status === 400 ? "검토 중인 신청만 취소할 수 있어요." : "로그인이 필요해요." }, { status });
  }
}
