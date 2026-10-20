import { MeetingForm } from "@/components/meeting/MeetingForm";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCommunities } from "@/repositories/communityRepository";

export default async function WriteMeetingPage() {
  await requireRole("community_host", "/meetings/new/write");
  const communities = await getMyCommunities(await createAuthServerSupabaseClient());
  return <section className="section meeting-editor-page"><div className="container"><MeetingForm communities={communities.map(({ id, name }) => ({ id, name }))} /></div></section>;
}
