import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationStatus, CommunityApplication, CreateCommunityApplicationInput } from "@/types/community";

const map = (row: any): CommunityApplication => ({ id: row.id, communityId: row.community_id, communityName: row.community_name ?? row.communities?.name ?? "", applicantUserId: row.applicant_user_id, applicantName: row.applicant_name, applicantContact: row.applicant_contact, introduction: row.introduction, motivation: row.motivation, answers: row.answers ?? {}, status: row.status, operatorMemo: row.operator_memo, appliedAt: row.applied_at ?? row.created_at, updatedAt: row.updated_at, communitySlug: row.communities?.slug, nextMeetingAt: row.communities?.next_meeting_at });
async function currentUserId(db: SupabaseClient) { const { data: { user }, error } = await db.auth.getUser(); if (error || !user) throw new Error("AUTH_REQUIRED"); return user.id; }

export async function getMyApplications(db: SupabaseClient) {
  const userId = await currentUserId(db);
  const { data, error } = await db.from("community_applications").select("*,communities(name,slug,next_meeting_at)").eq("applicant_user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(map);
}

export async function getApplicationsForMyCommunities(db: SupabaseClient) {
  const userId = await currentUserId(db);
  const { data, error } = await db.from("community_applications").select("*,communities!inner(name,slug,next_meeting_at,owner_id)").eq("communities.owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(map);
}
export const listApplications = getApplicationsForMyCommunities;

export async function getApplicationForOwner(db: SupabaseClient, id: string) {
  const userId = await currentUserId(db);
  const { data, error } = await db.from("community_applications").select("*,communities!inner(name,slug,next_meeting_at,owner_id)").eq("id", id).eq("communities.owner_id", userId).maybeSingle();
  if (error) throw error;
  return data ? map(data) : null;
}

export async function createApplicationForCurrentUser(db: SupabaseClient, communityId: string, communityName: string, values: CreateCommunityApplicationInput) {
  const userId = await currentUserId(db);
  const { data: duplicate, error: duplicateError } = await db.from("community_applications").select("id").eq("community_id", communityId).eq("applicant_user_id", userId).in("status", ["pending", "approved"]).maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) throw new Error("DUPLICATE_APPLICATION");
  const { data: contactDuplicate, error: contactError } = await db.from("community_applications").select("id").eq("community_id", communityId).eq("applicant_contact", values.applicantContact).in("status", ["pending", "approved"]).maybeSingle();
  if (contactError) throw contactError;
  if (contactDuplicate) throw new Error("DUPLICATE_APPLICATION");
  const { data, error } = await db.from("community_applications").insert({ community_id: communityId, community_name: communityName, applicant_user_id: userId, applicant_name: values.applicantName, applicant_contact: values.applicantContact, introduction: values.introduction, motivation: values.motivation, answers: values.answers, status: "pending" }).select().single();
  if (error) { if (error.code === "23505") throw new Error("DUPLICATE_APPLICATION"); throw error; }
  return map({ ...data, community_name: communityName });
}
export const createApplication = createApplicationForCurrentUser;

export async function cancelMyApplication(db: SupabaseClient, id: string) { const { error } = await db.rpc("cancel_my_application", { p_application_id: id }); if (error) throw error; }
export async function updateApplicationStatusAsOwner(db: SupabaseClient, id: string, status: ApplicationStatus, operatorMemo?: string | null) { const { error } = await db.rpc("change_application_status_as_owner", { p_application_id: id, p_status: status, p_operator_memo: operatorMemo ?? null }); if (error) { if (error.message.includes("CAPACITY_FULL")) throw new Error("CAPACITY_FULL"); throw error; } }
export const updateApplication = updateApplicationStatusAsOwner;
