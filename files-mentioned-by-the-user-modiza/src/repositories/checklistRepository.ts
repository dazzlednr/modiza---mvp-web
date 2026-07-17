import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistGroup, ChecklistItem } from "@/types/operator";

export async function getChecklistsForMyCommunities(db: SupabaseClient) {
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!user) return [];

  const { data, error } = await db
    .from("checklist_groups")
    .select("*,checklist_items(*),communities!inner(owner_id)")
    .eq("communities.owner_id", user.id)
    .order("display_order");
  if (error) throw error;

  return (data ?? []).map((group: any): ChecklistGroup => ({
    id: group.id,
    communityId: group.community_id,
    title: group.title,
    order: group.display_order,
    items: (group.checklist_items ?? []).map((item: any): ChecklistItem => ({
      id: item.id,
      title: item.title,
      completed: item.completed,
      dueDate: item.due_date ?? undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  }));
}
export const listChecklistGroups = getChecklistsForMyCommunities;
export async function createChecklistForMyCommunity(db: SupabaseClient, communityId: string, title: string, order: number) { const { error } = await db.from("checklist_groups").insert({ community_id: communityId, title, display_order: order }); if (error) throw error; }
export async function createChecklistGroup(db: SupabaseClient, title: string, order: number, communityId?: string) { if (!communityId) throw new Error("COMMUNITY_REQUIRED"); return createChecklistForMyCommunity(db, communityId, title, order); }
export async function createChecklistItem(db: SupabaseClient, groupId: string, title: string) { const { error } = await db.from("checklist_items").insert({ group_id: groupId, title }); if (error) throw error; }
export async function updateMyChecklistItem(db: SupabaseClient, id: string, patch: Partial<ChecklistItem>) { const values: Record<string, unknown> = {}; if (patch.title !== undefined) values.title = patch.title; if (patch.completed !== undefined) values.completed = patch.completed; if (patch.dueDate !== undefined) values.due_date = patch.dueDate; const { error } = await db.from("checklist_items").update(values).eq("id", id); if (error) throw error; }
export const updateChecklistItem = updateMyChecklistItem;
export async function deleteChecklistItem(db: SupabaseClient, id: string) { const { error } = await db.from("checklist_items").delete().eq("id", id); if (error) throw error; }
