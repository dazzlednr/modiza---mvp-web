import { notFound } from "next/navigation";
import { CommunityForm } from "@/components/community/CommunityForm";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCommunityById } from "@/repositories/communityRepository";
import { getActiveSpaces } from "@/repositories/spaceRepository";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const db = await createAuthServerSupabaseClient();
  const [community, spaces] = await Promise.all([getMyCommunityById(db, (await params).id), getActiveSpaces(db)]);
  if (!community) notFound();
  return <section className="section"><div className="container" style={{ maxWidth: 960 }}><p className="eyebrow">Edit community</p><h1 className="section-title">커뮤니티 수정</h1><CommunityForm community={community} spaces={spaces.map((space) => ({ id: space.id, slug: space.slug, name: space.name, mainRegion: space.mainRegion, address: space.address, maxCapacity: space.maxCapacity, thumbnailUrl: space.thumbnailUrl }))} /></div></section>;
}
