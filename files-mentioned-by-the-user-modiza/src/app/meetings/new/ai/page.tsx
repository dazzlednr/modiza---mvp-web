import { MeetingAiFlow } from "@/components/meeting/MeetingAiFlow";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCommunities } from "@/repositories/communityRepository";

export default async function AiMeetingPage() {
  await requireRole("community_host", "/meetings/new/ai");
  const communities = await getMyCommunities(await createAuthServerSupabaseClient());
  return <section className="section meeting-editor-page"><div className="container"><MeetingAiFlow communities={communities.map(({ id, name }) => ({ id, name }))} /></div></section>;
}
