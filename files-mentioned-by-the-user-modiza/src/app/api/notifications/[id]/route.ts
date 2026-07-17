import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { markNotificationRead } from "@/repositories/notificationRepository";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser();
    await markNotificationRead(supabase, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    const notFound = error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND";
    return NextResponse.json(
      { message: notFound ? "알림을 찾을 수 없어요." : "알림을 읽음 처리하지 못했어요." },
      { status: notFound ? 404 : status },
    );
  }
}
