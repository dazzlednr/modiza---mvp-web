import { MeetingManagement } from "@/components/meeting/MeetingManagement";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyMeetings } from "@/repositories/meetingRepository";

export const dynamic = "force-dynamic";

export default async function DashboardMeetingsPage() {
  await requireRole("community_host", "/dashboard/meetings");
  const meetings = await getMyMeetings(await createAuthServerSupabaseClient());
  return <section className="section"><div className="container"><MeetingManagement initialItems={meetings} /></div></section>;
}
