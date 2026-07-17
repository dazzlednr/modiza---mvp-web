import { CommunityExplorer } from "@/components/community";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { listCommunities } from "@/repositories/communityRepository";
import { getFavoriteIds } from "@/repositories/favoriteRepository";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ region?: string; category?: string }> }) {
  const db = await createAuthServerSupabaseClient();
  const [{ region, category }, items, auth] = await Promise.all([searchParams, listCommunities(db), db.auth.getUser()]);
  const favoriteIds = auth.data.user ? await getFavoriteIds(db).catch(() => []) : [];
  return <section className="section"><div className="container"><p className="eyebrow">Explore communities</p><h1 className="section-title">{"\uB098\uC640 \uB9DE\uB294 \uCEE4\uBBA4\uB2C8\uD2F0\uB97C \uCC3E\uC544\uBCF4\uC138\uC694."}</h1><p className="muted">{"\uAD00\uC2EC\uC0AC\uC640 \uC9C0\uC5ED\uC744 \uACE8\uB77C \uB300\uAD6C\uC758 \uC0C8\uB85C\uC6B4 \uBAA8\uC784\uC744 \uBC1C\uACAC\uD574\uBCF4\uC138\uC694."}</p><CommunityExplorer items={items} initialRegion={region} initialCategory={category} favoriteIds={favoriteIds} authenticated={Boolean(auth.data.user)} /></div></section>;
}
