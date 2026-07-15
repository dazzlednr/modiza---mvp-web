import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getMyApplications } from "@/repositories/applicationRepository";

export async function GET() {
  try {
    const { supabase } = await requireApiUser();
    return NextResponse.json(await getMyApplications(supabase));
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: status === 500 ? "내 신청을 불러오지 못했어요." : "로그인이 필요해요." }, { status });
  }
}
