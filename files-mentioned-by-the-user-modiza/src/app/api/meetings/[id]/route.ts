import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getMeetingErrorMessage } from "@/lib/meeting/validation";
import { getMyMeetingById, isMeetingsMigrationPending, updateMyMeeting, uploadMeetingImage } from "@/repositories/meetingRepository";
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
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const body = isMultipart ? await request.formData() : await request.json();
    const rawInput = isMultipart ? JSON.parse(String(body.get("meeting") ?? "{}")) : body;
    const image = isMultipart ? body.get("image") : null;
    if (image instanceof File && (image.size > 5_242_880 || !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      return NextResponse.json({ message: "대표 이미지는 JPG, PNG, WebP 형식의 5MB 이하 파일만 가능해요." }, { status: 400 });
    }
    const id = (await context.params).id;
    const meeting = await updateMyMeeting(supabase, id, MeetingInputSchema.parse(rawInput));
    if (image instanceof File && image.size) await uploadMeetingImage(supabase, id, image);
    return NextResponse.json(image instanceof File && image.size ? { ...meeting, imageUrl: await getMyMeetingById(supabase, id).then((updated) => updated?.imageUrl ?? meeting.imageUrl) } : meeting);
  } catch (error) {
    return responseError(error);
  }
}
