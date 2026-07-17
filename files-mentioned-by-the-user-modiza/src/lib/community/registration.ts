import "server-only";

import { normalizeCommunityCategory, PRIMARY_REGION } from "@/constants/taxonomy";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveSpaces } from "@/repositories/spaceRepository";
import type { CommunityFormValues } from "@/types/community";

export type RegistrationQuery = {
  spaceId?: string;
  activityType?: string;
  capacity?: string;
  region?: string;
  date?: string;
};

export async function getCommunityRegistrationContext(query: RegistrationQuery) {
  const spaces = await getActiveSpaces(await createAuthServerSupabaseClient());
  const selected = spaces.find((space) => space.id === query.spaceId);
  const category = normalizeCommunityCategory(query.activityType);
  const suggested: Partial<CommunityFormValues> = {
    linkedSpaceId: selected?.id ?? null,
    category,
    customCategory: "",
    capacity: Math.min(Math.max(Number(query.capacity) || 10, 1), selected?.maxCapacity ?? 1000),
    mainRegion: selected?.mainRegion ?? PRIMARY_REGION,
    detailedRegion: selected?.detailedRegion ?? "",
    customRegion: selected?.customRegion ?? query.region ?? "",
    nextMeetingAt: query.date ? `${query.date}T19:00` : "",
  };
  return {
    suggested,
    spaces: spaces.map((space) => ({
      id: space.id,
      slug: space.slug,
      name: space.name,
      mainRegion: space.mainRegion,
      detailedRegion: space.detailedRegion,
      customRegion: space.customRegion,
      address: space.address,
      maxCapacity: space.maxCapacity,
      thumbnailUrl: space.thumbnailUrl,
    })),
  };
}

export function registrationQueryString(query: RegistrationQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.size ? `?${params.toString()}` : "";
}
