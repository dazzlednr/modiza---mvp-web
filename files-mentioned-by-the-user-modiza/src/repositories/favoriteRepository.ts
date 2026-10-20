import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateRecruitmentStatus } from "@/lib/community/recruitment";
import { getMyApplications } from "@/repositories/applicationRepository";
import { mapCommunity } from "@/repositories/communityRepository";
import type { Community } from "@/types/community";
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

/** MVP recommendation weights. Keep these together so they can be tuned without changing the ranking flow. */
export const recommendationWeights = {
  interest: 40,
  region: 30,
  activity: 20,
  recruitment: 10,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function interestFit(community: Community, interests: string[]) {
  if (!interests.length) return 0;
  const comparable = [community.category, community.customCategory ?? "", ...community.tags]
    .filter(Boolean)
    .map(normalized);
  return interests.some((interest) => {
    const target = normalized(interest);
    return target.length > 0 && comparable.some((value) => value === target || value.includes(target) || target.includes(value));
  }) ? 1 : 0;
}

function regionFit(community: Community, regions: string[]) {
  if (!regions.length) return 0;
  const mainRegion = normalized(community.mainRegion);
  const detailedRegion = normalized(community.detailedRegion);
  const customRegion = normalized(community.customRegion ?? "");

  let best = 0;
  for (const region of regions) {
    const target = normalized(region);
    if (!target || target === "전체") continue;
    if ((detailedRegion && target === detailedRegion) || (customRegion && target === customRegion)) best = Math.max(best, 1);
    else if (target === mainRegion || (detailedRegion && (detailedRegion.includes(target) || target.includes(detailedRegion))) || (customRegion && (customRegion.includes(target) || target.includes(customRegion)))) best = Math.max(best, 0.6);
    else if (mainRegion && (mainRegion.includes(target) || target.includes(mainRegion))) best = Math.max(best, 0.4);
  }
  return best;
}

function activityFit(community: Community, now: number) {
  const nextMeeting = community.nextMeetingAt ? new Date(community.nextMeetingAt).getTime() : Number.NaN;
  if (Number.isFinite(nextMeeting) && nextMeeting > now) return 1;

  // A new community should remain discoverable even before its first schedule is fixed.
  const ageDays = Math.max(0, (now - new Date(community.createdAt).getTime()) / DAY_MS);
  if (ageDays <= 30) return 0.6;
  if (ageDays <= 90) return 0.35;
  return 0.15;
}

function canRecommend(community: Community, now: number) {
  if (community.status !== "published" || community.visibility !== "discover") return false;
  if (community.nextMeetingAt && new Date(community.nextMeetingAt).getTime() <= now) return false;
  return true;
}

export async function getRecommendedCommunities(
  db: SupabaseClient,
  profile: Profile | null,
  limit = 6,
): Promise<RecommendedCommunity[]> {
  const [{ data, error }, favorites, applications] = await Promise.all([
    db.from("communities").select("*").eq("status", "published").eq("visibility", "discover"),
    getFavorites(db),
    getMyApplications(db),
  ]);
  if (error) throw error;

  const interests = [...new Set([...(profile?.interestedCategories ?? []), ...(profile?.interestCategories ?? [])])];
  const regions = [...new Set(profile?.interestedRegions ?? [])];
  const excludedCommunityIds = new Set([
    ...favorites.map((item) => item.communityId),
    ...applications.map((item) => item.communityId),
  ]);
  const hasPersonalization = interests.length > 0 || regions.some((region) => normalized(region) !== "전체");
  const now = Date.now();

  return (data ?? []).map(mapCommunity)
    .filter((community) => canRecommend(community, now) && !excludedCommunityIds.has(community.id))
    .map((community): RecommendedCommunity => {
    const interest = interestFit(community, interests);
    const region = regionFit(community, regions);
    const activity = activityFit(community, now);
    const recruitment = calculateRecruitmentStatus(community) === "recruiting" ? 1 : 0;
    const score = hasPersonalization
      ? interest * recommendationWeights.interest
        + region * recommendationWeights.region
        + activity * recommendationWeights.activity
        + recruitment * recommendationWeights.recruitment
      : 0;
    return { community, score };
  })
    .sort((a, b) => b.score - a.score || new Date(b.community.createdAt).getTime() - new Date(a.community.createdAt).getTime())
    .slice(0, limit);
}
