import { notFound } from "next/navigation";
import Link from "next/link";
import { SpaceDetailContent } from "@/components/space/SpaceDetailContent";
import { SpaceSelectionButton } from "@/components/space/SpaceSelectionButton";
import { getCurrentUserWithProfile } from "@/lib/auth/access";
import { hasAnyRole } from "@/lib/auth/roles";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getSpaceBySlug } from "@/repositories/spaceRepository";

export const dynamic = "force-dynamic";

export default async function SpaceDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ requestCommunityId?: string }> }) {
  const raw = (await params).slug;
  let slug = raw;
  try { slug = decodeURIComponent(raw); } catch { /* invalid encoded slug */ }
  const space = await getSpaceBySlug(await createAuthServerSupabaseClient(), slug);
  if (!space) notFound();
  const current = await getCurrentUserWithProfile();
  const initialCommunityId = (await searchParams).requestCommunityId ?? "";
  const detailPath = `/spaces/${space.slug}?requestCommunityId=${encodeURIComponent(initialCommunityId)}`;
  const action = !initialCommunityId
    ? undefined
    : !current
      ? <Link className="btn btn-primary" href={`/login?redirect=${encodeURIComponent(detailPath)}`}>로그인 후 이 공간 선택하기</Link>
      : hasAnyRole(current.profile, ["community_host", "admin"])
        ? <SpaceSelectionButton spaceId={space.id} communityId={initialCommunityId} />
        : undefined;

  return <section className="section"><div className="container space-detail-page">
    <SpaceDetailContent space={space} actions={action} />
  </div></section>;
}
