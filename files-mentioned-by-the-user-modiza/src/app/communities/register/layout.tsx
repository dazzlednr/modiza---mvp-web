import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getCommunityHostProfile } from "@/repositories/communityHostProfileRepository";

export default async function CommunityRegisterLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("community_host");
  const db = await createAuthServerSupabaseClient();
  const hostProfile = await getCommunityHostProfile(db, user.id).catch(() => null);
  if (!hostProfile) redirect("/community-host/start?redirect=/communities/register");
  return children;
}
