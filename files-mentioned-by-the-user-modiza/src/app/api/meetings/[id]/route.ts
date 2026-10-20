import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getMeetingErrorMessage } from "@/lib/meeting/validation";
import { getMyMeetingById, isMeetingsMigrationPending, updateMyMeeting } from "@/repositories/meetingRepository";
import { MeetingInputSchema } from "@/types/meeting";

function responseError(error: unknown) {
  const authStatus = apiAuthStatus(error);
  if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
  if (isMeetingsMigrationPending(error)) return NextResponse.json({ message: "모임 데이터베이스 준비가 필요해요." }, { status: 503 });
  console.error("[MODIZA][meeting] request failed", error);
  return NextResponse.json({ message: getMeetingErrorMessage(error) }, { status: 400 });
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const meeting = await getMyMeetingById(supabase, (await context.params).id);
    if (!meeting) return NextResponse.json({ message: "모임을 찾을 수 없어요." }, { status: 404 });
    return NextResponse.json(meeting);
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const input = MeetingInputSchema.parse(await request.json());
    return NextResponse.json(await updateMyMeeting(supabase, (await context.params).id, input));
  } catch (error) {
    return responseError(error);
  }
}
