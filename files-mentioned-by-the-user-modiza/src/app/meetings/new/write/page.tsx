import { MeetingForm } from "@/components/meeting/MeetingForm";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCommunities } from "@/repositories/communityRepository";
import { getActiveSpaces } from "@/repositories/spaceRepository";

export default async function WriteMeetingPage() {
  await requireRole("community_host", "/meetings/new/write");
  const db = await createAuthServerSupabaseClient();
  const [communities, spaces] = await Promise.all([getMyCommunities(db), getActiveSpaces(db)]);
  return <section className="section meeting-editor-page"><div className="container"><MeetingForm communities={communities.map(({ id, name }) => ({ id, name }))} spaces={spaces.map(({ id, name, address, addressDetail, thumbnailUrl }) => ({ id, name, address, addressDetail, thumbnailUrl }))} /></div></section>;
}
