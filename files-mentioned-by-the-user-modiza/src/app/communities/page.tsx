import { CommunityExplorer } from "@/components/community";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listCommunities } from "@/repositories/communityRepository";
export default async function Page({ searchParams }: { searchParams: Promise<{ region?: string; category?: string }> }) { const [{ region, category }, items] = await Promise.all([searchParams, listCommunities(createServerSupabaseClient())]); return <section className="section"><div className="container"><p className="eyebrow">Explore communities</p><h1 className="section-title">나와 맞는 커뮤니티를 찾아보세요</h1><p className="muted">관심사와 동네를 골라 대구의 다채로운 모임을 발견해보세요.</p><CommunityExplorer items={items} initialRegion={region} initialCategory={category} /></div></section>; }
