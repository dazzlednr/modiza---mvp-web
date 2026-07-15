import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getApplicationsForMyCommunities } from "@/repositories/applicationRepository";

export async function GET() {
  try {
    const { supabase } = await requireApiUser("community_host");
    return NextResponse.json(await getApplicationsForMyCommunities(supabase));
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: status === 500 ? "신청 목록을 불러오지 못했어요." : error instanceof Error ? error.message : "권한이 없어요." }, { status });
  }
}
