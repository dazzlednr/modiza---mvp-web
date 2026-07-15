import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyApplications, getApplicationsForMyCommunities } from "@/repositories/applicationRepository";
import { getMyCommunities } from "@/repositories/communityRepository";
import { getSchedulesForMyCommunities } from "@/repositories/scheduleRepository";
import { getChecklistsForMyCommunities } from "@/repositories/checklistRepository";
import { getMySpaces } from "@/repositories/spaceRepository";
import type { UserRole } from "@/types/profile";

export async function getPersonalizedDashboard(db: SupabaseClient, roles: UserRole[]) {
  const communityHost = roles.includes("community_host");
  const spaceHost = roles.includes("space_host");
  const [myApplications, communities, receivedApplications, schedules, checklistGroups, spaces] = await Promise.all([
    getMyApplications(db),
    communityHost ? getMyCommunities(db) : Promise.resolve([]),
    communityHost ? getApplicationsForMyCommunities(db) : Promise.resolve([]),
    communityHost ? getSchedulesForMyCommunities(db) : Promise.resolve([]),
    communityHost ? getChecklistsForMyCommunities(db) : Promise.resolve([]),
    spaceHost ? getMySpaces(db) : Promise.resolve([]),
  ]);

  return { myApplications, communities, receivedApplications, schedules, checklistGroups, spaces };
}
