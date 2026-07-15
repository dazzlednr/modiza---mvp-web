import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRoles, hasRole } from "@/lib/auth/roles";
import type { Profile, UserRole } from "@/types/profile";

function map(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email),
    nickname: String(row.nickname),
    profileImage: row.profile_image ? String(row.profile_image) : null,
    bio: row.bio ? String(row.bio) : null,
    mainRegion: row.main_region ? String(row.main_region) : "대구 전체",
    detailedRegion: row.detailed_region ? String(row.detailed_region) : null,
    customRegion: row.custom_region ? String(row.custom_region) : null,
    interestCategories: Array.isArray(row.interest_categories) ? row.interest_categories.map(String) : [],
    roles: normalizeRoles(row.roles),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getProfileById(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data) : null;
}

export const getProfileByUserId = getProfileById;

export async function getCurrentProfile(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error) throw error;
  return user ? getProfileByUserId(db, user.id) : null;
}

export async function addUserRole(
  db: SupabaseClient,
  role: "community_host" | "space_host",
) {
  const { data, error } = await db.rpc("add_current_user_role", {
    requested_role: role,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("PROFILE_NOT_FOUND");
  return map(row as Record<string, unknown>);
}

export async function hasUserRole(
  db: SupabaseClient,
  userId: string,
  role: UserRole,
) {
  return hasRole(await getProfileByUserId(db, userId), role);
}

export async function updateProfile(
  db: SupabaseClient,
  userId: string,
  values: { nickname?: string; profileImage?: string | null; bio?: string | null; mainRegion?: string; detailedRegion?: string | null; customRegion?: string | null; interestCategories?: string[] },
) {
  const { data, error } = await db
    .from("profiles")
    .update({
      ...(values.nickname !== undefined && { nickname: values.nickname }),
      ...(values.profileImage !== undefined && { profile_image: values.profileImage }),
      ...(values.bio !== undefined && { bio: values.bio }),
      ...(values.mainRegion !== undefined && { main_region: values.mainRegion }),
      ...(values.detailedRegion !== undefined && { detailed_region: values.detailedRegion }),
      ...(values.customRegion !== undefined && { custom_region: values.customRegion }),
      ...(values.interestCategories !== undefined && { interest_categories: values.interestCategories }),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return map(data as Record<string, unknown>);
}

export async function ensureMemberRole(db: SupabaseClient) {
  const { data, error } = await db.rpc("ensure_current_member_role");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("PROFILE_NOT_FOUND");
  return map(row as Record<string, unknown>);
}
