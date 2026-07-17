import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationItem } from "@/types/notification";

const map = (row: any): NotificationItem => ({
  id: row.id, type: row.type, title: row.title, message: row.message, link: row.link,
  relatedCommunityId: row.related_community_id, relatedApplicationId: row.related_application_id,
  isRead: row.is_read, createdAt: row.created_at, readAt: row.read_at,
});

async function userId(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  return user.id;
}

export async function getNotifications(db: SupabaseClient, offset = 0, limit = 20) {
  const id = await userId(db);
  const { data, error, count } = await db.from("notifications").select("*", { count: "exact" }).eq("user_id", id).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return { items: (data ?? []).map(map), total: count ?? 0 };
}

export async function getUnreadNotificationCount(db: SupabaseClient) {
  const id = await userId(db);
  const { count, error } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", id).eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(db: SupabaseClient, notificationId: string) {
  const id = await userId(db);
  const { data, error } = await db.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("NOTIFICATION_NOT_FOUND");
}

export async function markAllNotificationsRead(db: SupabaseClient) {
  const id = await userId(db);
  const { error } = await db.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", id).eq("is_read", false);
  if (error) throw error;
}
