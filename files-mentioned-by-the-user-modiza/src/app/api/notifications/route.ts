import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead } from "@/repositories/notificationRepository";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    const [{ items, total }, unread] = await Promise.all([getNotifications(supabase, offset, limit), getUnreadNotificationCount(supabase)]);
    return NextResponse.json(
      { items, total, unread, hasMore: offset + items.length < total },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: status === 401 ? "로그인이 필요해요." : "알림을 불러오지 못했어요." }, { status });
  }
}

export async function PATCH() {
  try {
    const { supabase } = await requireApiUser();
    await markAllNotificationsRead(supabase);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: "알림을 읽음 처리하지 못했어요." }, { status });
  }
}
