import "server-only";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { hasAnyRole, hasRole } from "@/lib/auth/roles";
import { loginPath, roleStartPath, safeInternalPath } from "@/lib/auth/redirect";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/repositories/profileRepository";
import type { Profile, UserRole } from "@/types/profile";

export type CurrentUserWithProfile = {
  user: User;
  profile: Profile | null;
};

export async function getRequestDestination(fallback = "/mypage") {
  const requestHeaders = await headers();
  return safeInternalPath(requestHeaders.get("x-modiza-path"), fallback);
}

export async function getCurrentUserWithProfile(): Promise<CurrentUserWithProfile | null> {
  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let profile: Profile | null = null;
  try {
    profile = await getProfileByUserId(supabase, user.id);
  } catch (error) {
    // Keeps login usable while a newly added migration is still pending.
    console.error("[MODIZA][auth] profile lookup failed", { userId: user.id, error });
  }
  return { user, profile };
}

export async function requireUser(destination?: string) {
  const intendedDestination = destination ?? await getRequestDestination();
  const current = await getCurrentUserWithProfile();
  if (!current) redirect(loginPath(intendedDestination));
  return current;
}

export async function requireRole(
  role: "community_host" | "space_host",
  destination?: string,
) {
  const intendedDestination = destination ?? await getRequestDestination();
  const current = await requireUser(intendedDestination);
  if (!hasRole(current.profile, role) && !hasRole(current.profile, "admin")) {
    if (role === "space_host") redirect("/space-host/apply");
    if (role === "community_host") redirect(`/community-host/start?redirect=${encodeURIComponent(intendedDestination)}`);
    redirect(roleStartPath(intendedDestination, role));
  }
  return current;
}

export async function requireAnyRole(
  roles: UserRole[],
  destination?: string,
) {
  const intendedDestination = destination ?? await getRequestDestination();
  const current = await requireUser(intendedDestination);
  if (!hasAnyRole(current.profile, roles) && !hasRole(current.profile, "admin")) {
    redirect(roleStartPath(intendedDestination));
  }
  return current;
}

export async function requireAdmin(destination = "/admin") {
  const current = await requireUser(destination);
  if (!hasRole(current.profile, "admin")) redirect("/mypage?error=forbidden");
  return current;
}
