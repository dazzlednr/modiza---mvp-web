import "server-only";

import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/roles";
import { getProfileByUserId } from "@/repositories/profileRepository";
import type { UserRole } from "@/types/profile";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export class ApiAuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function requireApiUser(role?: UserRole) {
  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiAuthError(401, "로그인이 필요해요.");
  const profile = await getProfileByUserId(supabase, user.id);
  if (profile?.accountStatus === "suspended") throw new ApiAuthError(403, "정지된 계정은 이 기능을 사용할 수 없어요.");
  if (role && !hasRole(profile, role) && !hasRole(profile, "admin")) {
    throw new ApiAuthError(403, "이 기능을 사용할 권한이 없어요.");
  }
  return { supabase, user, profile };
}

export async function requireApiAdmin() {
  const context = await requireApiUser("admin");
  return { ...context, admin: createAdminSupabaseClient() };
}

export function apiAuthStatus(error: unknown) {
  return error instanceof ApiAuthError ? error.status : null;
}
