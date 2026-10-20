import { notFound } from "next/navigation";
import { MeetingForm } from "@/components/meeting/MeetingForm";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCommunities } from "@/repositories/communityRepository";
import { getActiveSpaces } from "@/repositories/spaceRepository";
import { getMyMeetingById } from "@/repositories/meetingRepository";

export const dynamic = "force-dynamic";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("community_host", "/dashboard/meetings");
  const db = await createAuthServerSupabaseClient();
  const [meeting, communities, spaces] = await Promise.all([getMyMeetingById(db, (await params).id), getMyCommunities(db), getActiveSpaces(db)]);
  if (!meeting) notFound();
  return <section className="section meeting-editor-page"><div className="container"><MeetingForm meeting={meeting} communities={communities.map(({ id, name, category, detailedRegion, moodTags, activityDescription, budgetMax, expectedDurationHours, requiredFacilities, foodDrinkNeeded }) => ({ id, name, category, detailedRegion, moodTags, activityDescription, budgetMax, expectedDurationHours, requiredFacilities, foodDrinkNeeded }))} spaces={spaces.map(({ id, name, address, addressDetail, thumbnailUrl }) => ({ id, name, address, addressDetail, thumbnailUrl }))} /></div></section>;
}
