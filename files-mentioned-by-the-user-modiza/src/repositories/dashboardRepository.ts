import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyApplications, getApplicationsForMyCommunities } from "@/repositories/applicationRepository";
import { getMyCommunities } from "@/repositories/communityRepository";
import { getSchedulesForMyCommunities } from "@/repositories/scheduleRepository";
import { getChecklistsForMyCommunities } from "@/repositories/checklistRepository";
import { getMySpaces } from "@/repositories/spaceRepository";
import { getFavorites, getRecommendedCommunities } from "@/repositories/favoriteRepository";
import type { Profile } from "@/types/profile";

export async function getMemberDashboard(db: SupabaseClient, profile: Profile | null) {
  const [applications, favorites, recommendations] = await Promise.all([
    getMyApplications(db),
    getFavorites(db).catch(() => []),
    getRecommendedCommunities(db, profile, 5).catch(() => []),
  ]);
  return { applications, favorites, recommendations };
}

export async function getCommunityHostDashboard(db: SupabaseClient) {
  const errors: Record<string, string> = {};
  async function safe<T>(key: string, request: () => Promise<T>, fallback: T) {
    try {
      return await request();
    } catch (error) {
      console.error(`[MODIZA][community-dashboard] ${key} load failed`, error);
      errors[key] = "데이터를 불러오지 못했어요.";
      return fallback;
    }
  }

  const [communities, applications, schedules, checklistGroups] = await Promise.all([
    safe("communities", () => getMyCommunities(db), []),
    safe("applications", () => getApplicationsForMyCommunities(db), []),
    safe("schedules", () => getSchedulesForMyCommunities(db), []),
    safe("checklists", () => getChecklistsForMyCommunities(db), []),
  ]);
  const linkedSpaceIds = [...new Set(communities.map((item) => item.linkedSpaceId).filter((id): id is string => Boolean(id)))];
  const placeNames: Record<string, string> = {};
  const places: Record<string, { id: string; name: string; slug: string; address: string; addressDetail: string | null }> = {};
  const openChatCommunityIds: string[] = [];

  if (linkedSpaceIds.length) {
    const rows = await safe("places", async () => {
      const { data, error } = await db.from("spaces").select("id,name,slug,address,address_detail").in("id", linkedSpaceIds);
      if (error) throw error;
      return data ?? [];
    }, []);
    for (const space of rows) {
      const id = String(space.id);
      placeNames[id] = String(space.name);
      places[id] = {
        id,
        name: String(space.name),
        slug: String(space.slug),
        address: String(space.address ?? ""),
        addressDetail: space.address_detail ? String(space.address_detail) : null,
      };
    }
  }

  const { data: { user } } = await db.auth.getUser();
  if (user) {
    const rows = await safe("openChats", async () => {
      const { data, error } = await db
        .from("community_open_chats")
        .select("community_id")
        .eq("owner_id", user.id);
      if (error) throw error;
      return data ?? [];
    }, []);
    openChatCommunityIds.push(...rows.map((row) => String(row.community_id)));
  }

  return {
    communities,
    applications,
    schedules,
    checklistGroups,
    placeNames,
    places,
    openChatCommunityIds,
    errors,
  };
}

export async function getSpaceHostDashboard(db: SupabaseClient) {
  return { spaces: await getMySpaces(db) };
}
