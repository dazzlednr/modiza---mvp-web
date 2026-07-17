import Link from "next/link";
import { Heart } from "lucide-react";
import { CommunityGrid } from "@/components/community";
import { requireUser } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getFavoriteCount, getFavorites } from "@/repositories/favoriteRepository";

export const dynamic = "force-dynamic";

export default async function FavoriteCommunitiesPage() {
  await requireUser("/mypage/favorites");
  const db = await createAuthServerSupabaseClient();
  const [favorites, favoriteCount] = await Promise.all([getFavorites(db), getFavoriteCount(db)]);
  return <section className="section"><div className="container"><p className="eyebrow">My favorites</p><div className="section-heading"><h1 className="section-title">{"\uAD00\uC2EC \uCEE4\uBBA4\uB2C8\uD2F0"}</h1><span className="tag">{favoriteCount}{"\uAC1C \uC800\uC7A5"}</span></div>{favorites.length ? <CommunityGrid items={favorites.map((item)=>item.community)} favoriteIds={favorites.map((item)=>item.communityId)} authenticated /> : <div className="empty"><Heart size={42}/><h3>{"\uC544\uC9C1 \uC800\uC7A5\uD55C \uCEE4\uBBA4\uB2C8\uD2F0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</h3><Link className="btn btn-primary" href="/communities">{"\uCEE4\uBBA4\uB2C8\uD2F0 \uB458\uB7EC\uBCF4\uAE30"}</Link></div>}</div></section>;
}
