import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getMeetingErrorMessage } from "@/lib/meeting/validation";
import { duplicateMyMeeting, isMeetingsMigrationPending } from "@/repositories/meetingRepository";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    return NextResponse.json(await duplicateMyMeeting(supabase, (await context.params).id), { status: 201 });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    if (isMeetingsMigrationPending(error)) return NextResponse.json({ message: "모임 데이터베이스 준비가 필요해요." }, { status: 503 });
    console.error("[MODIZA][meeting-duplicate] failed", error);
    return NextResponse.json({ message: getMeetingErrorMessage(error) }, { status: 400 });
  }
}
