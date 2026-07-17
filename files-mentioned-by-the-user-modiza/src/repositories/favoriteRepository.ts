import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateRecruitmentStatus } from "@/lib/community/recruitment";
import { mapCommunity } from "@/repositories/communityRepository";
import type { Profile } from "@/types/profile";
import type { CommunityFavorite, RecommendedCommunity } from "@/types/favorite";

async function currentUserId(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  return user.id;
}

const missingFavorites = (error: { code?: string } | null) =>
  error?.code === "PGRST205" || error?.code === "42P01";

export async function getFavoriteIds(db: SupabaseClient): Promise<string[]> {
  const userId = await currentUserId(db);
  const { data, error } = await db.from("community_favorites").select("community_id").eq("user_id", userId);
  if (missingFavorites(error)) return [];
  if (error) throw error;
  return (data ?? []).map((row) => String(row.community_id));
}

export async function getFavoriteCount(db: SupabaseClient): Promise<number> {
  const userId = await currentUserId(db);
  const { count, error } = await db.from("community_favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (missingFavorites(error)) return 0;
  if (error) throw error;
  return count ?? 0;
}

export async function getFavorites(db: SupabaseClient): Promise<CommunityFavorite[]> {
  const userId = await currentUserId(db);
  const { data, error } = await db.from("community_favorites")
    .select("id,user_id,community_id,created_at,communities(*)")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (missingFavorites(error)) return [];
  if (error) throw error;
  return (data ?? []).flatMap((row: any) => row.communities ? [{
    id: row.id, userId: row.user_id, communityId: row.community_id,
    createdAt: row.created_at, community: mapCommunity(row.communities),
  }] : []);
}

export async function addFavorite(db: SupabaseClient, communityId: string) {
  const userId = await currentUserId(db);
  const { error } = await db.from("community_favorites").upsert(
    { user_id: userId, community_id: communityId },
    { onConflict: "user_id,community_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function removeFavorite(db: SupabaseClient, communityId: string) {
  const userId = await currentUserId(db);
  const { error } = await db.from("community_favorites").delete()
    .eq("user_id", userId).eq("community_id", communityId);
  if (error) throw error;
}

export async function isFavorite(db: SupabaseClient, communityId: string) {
  return (await getFavoriteIds(db)).includes(communityId);
}

export async function getRecommendedCommunities(
  db: SupabaseClient,
  profile: Profile | null,
  limit = 6,
): Promise<RecommendedCommunity[]> {
  const [{ data, error }, favorites] = await Promise.all([
    db.from("communities").select("*").eq("status", "published"),
    getFavorites(db),
  ]);
  if (error) throw error;
  const categories = new Set(profile?.interestedCategories ?? []);
  const regions = new Set(profile?.interestedRegions ?? []);
  const savedCategories = new Set(favorites.map((item) => item.community.category));
  const savedByCategory = new Map(favorites.map((item) => [item.community.category, item.community.name]));
  const now = Date.now();

  return (data ?? []).map((row): RecommendedCommunity => {
    const community = mapCommunity(row);
    let score = 0;
    const reasons: string[] = [];
    const matchedCategory = [...categories].find((category) => community.category === category || community.category.includes(category) || category.includes(community.category) || community.tags.some((tag)=>tag.includes(category)));
    if (matchedCategory) { score += 40; reasons.push(`\uAD00\uC2EC \uC788\uB294 ${matchedCategory} \uCE74\uD14C\uACE0\uB9AC\uC785\uB2C8\uB2E4.`); }
    const regionSearchText = `${community.mainRegion} ${community.detailedRegion} ${community.customRegion ?? ""} ${community.name} ${community.shortDescription} ${community.tags.join(" ")}`;
    const matchedRegion = [...regions].find((region) => region === "\uC804\uCCB4" || regionSearchText.includes(region));
    if (matchedRegion) { score += 25; reasons.push(`\uAD00\uC2EC \uC9C0\uC5ED ${matchedRegion}\uC5D0\uC11C \uC9C4\uD589\uB429\uB2C8\uB2E4.`); }
    if (savedCategories.has(community.category)) { score += 20; reasons.push(`\uC800\uC7A5\uD55C ${savedByCategory.get(community.category)}\uACFC \uBE44\uC2B7\uD569\uB2C8\uB2E4.`); }
    if (calculateRecruitmentStatus(community) === "recruiting") { score += 10; reasons.push("\uD604\uC7AC \uBAA8\uC9D1 \uC911\uC785\uB2C8\uB2E4."); }
    if (community.nextMeetingAt) {
      const distance = new Date(community.nextMeetingAt).getTime() - now;
      if (distance >= 0 && distance <= 14 * 86400000) { score += 5; reasons.push("\uB2E4\uC74C \uBAA8\uC784 \uC77C\uC815\uC774 \uAC00\uAE5D\uC2B5\uB2C8\uB2E4."); }
    }
    return { community, score, reasons };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.community.createdAt).getTime() - new Date(a.community.createdAt).getTime())
    .slice(0, limit);
}
