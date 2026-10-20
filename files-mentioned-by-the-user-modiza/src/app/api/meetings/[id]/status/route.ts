import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getMeetingErrorMessage } from "@/lib/meeting/validation";
import { changeMyMeetingStatus, isMeetingsMigrationPending } from "@/repositories/meetingRepository";
import { meetingStatuses } from "@/types/meeting";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const { status } = z.object({ status: z.enum(meetingStatuses) }).parse(await request.json());
    return NextResponse.json(await changeMyMeetingStatus(supabase, (await context.params).id, status));
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    if (isMeetingsMigrationPending(error)) return NextResponse.json({ message: "모임 데이터베이스 준비가 필요해요." }, { status: 503 });
    console.error("[MODIZA][meeting-status] failed", error);
    return NextResponse.json({ message: getMeetingErrorMessage(error) }, { status: 400 });
  }
}
