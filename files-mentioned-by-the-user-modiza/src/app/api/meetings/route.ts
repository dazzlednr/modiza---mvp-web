import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { assertMeetingReady, getMeetingErrorMessage } from "@/lib/meeting/validation";
import { changeMyMeetingStatus, createMeetingDraft, getMyMeetings, isMeetingsMigrationPending, uploadMeetingImage } from "@/repositories/meetingRepository";
import { MeetingInputSchema } from "@/types/meeting";

function errorResponse(error: unknown) {
  const authStatus = apiAuthStatus(error);
  if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
  if (isMeetingsMigrationPending(error)) return NextResponse.json({ message: "모임 데이터베이스 준비가 필요해요. 관리자에게 마이그레이션 적용을 요청해 주세요." }, { status: 503 });
  console.error("[MODIZA][meetings] request failed", error);
  return NextResponse.json({ message: getMeetingErrorMessage(error) }, { status: 400 });
}

export async function GET() {
  try {
    const { supabase } = await requireApiUser("community_host");
    return NextResponse.json(await getMyMeetings(supabase));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const body = isMultipart ? await request.formData() : await request.json();
    const rawInput = isMultipart ? JSON.parse(String(body.get("meeting") ?? "{}")) : body.meeting ?? body;
    const startRecruiting = isMultipart ? String(body.get("startRecruiting")) === "true" : body.startRecruiting === true;
    const image = isMultipart ? body.get("image") : null;
    if (image instanceof File && (image.size > 5_242_880 || !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      return NextResponse.json({ message: "대표 이미지는 JPG, PNG, WebP 형식의 5MB 이하 파일만 가능해요." }, { status: 400 });
    }
    const input = MeetingInputSchema.parse(rawInput);
    if (startRecruiting) assertMeetingReady(input);
    let meeting = await createMeetingDraft(supabase, input);
    if (image instanceof File && image.size) await uploadMeetingImage(supabase, meeting.id, image);
    if (startRecruiting) meeting = await changeMyMeetingStatus(supabase, meeting.id, "recruiting");
    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
