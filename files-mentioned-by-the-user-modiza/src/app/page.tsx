import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, Heart, MapPin } from "lucide-react";
import { CommunityExplorer, CommunityGrid } from "@/components/community";
import { FavoriteButton } from "@/components/community/FavoriteButton";
import {createAuthServerSupabaseClient} from "@/lib/supabase/server";
import {listCommunities} from "@/repositories/communityRepository";
import {getFavoriteIds,getRecommendedCommunities} from "@/repositories/favoriteRepository";
import {getProfileByUserId} from "@/repositories/profileRepository";
import { representativeRegions } from "@/constants/regions";
export const dynamic="force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string; next?: string }> }) {
  const query = await searchParams;
  if (query.code) {
    const next = query.next?.startsWith("/") && !query.next.startsWith("//") ? query.next : "/mypage";
    redirect(`/auth/callback?code=${encodeURIComponent(query.code)}&next=${encodeURIComponent(next)}`);
  }
  const db=await createAuthServerSupabaseClient();
  const [communities,auth]=await Promise.all([listCommunities(db),db.auth.getUser()]);
  const profile=auth.data.user?await getProfileByUserId(db,auth.data.user.id).catch(()=>null):null;
  const favoriteIds=auth.data.user?await getFavoriteIds(db).catch(()=>[]):[];
  const recommendations=auth.data.user?await getRecommendedCommunities(db,profile,5).catch(()=>[]):[];
  return <>
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Meet your people in Daegu</p>
          <h1 className="hero-title">
            <span className="hero-title-line">취향이 맞는 사람들과</span>
            <span className="hero-title-line"><strong>우리만의 모임</strong>을 시작해요.</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.7 }}>대구의 다채로운 커뮤니티를 발견하고<br />새로운 사람들과 관심사를 나눠보세요.</p>
          <div className="meta" style={{ marginTop: 28 }}>
            <Link className="btn btn-primary" href="/communities">커뮤니티 둘러보기 <ArrowRight size={17} /></Link>
            <Link className="btn btn-ghost" href="/communities/register">커뮤니티 만들기</Link>
          </div>
        </div>
        <div className="hero-art">
          <Image src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85" alt="함께 웃는 커뮤니티 사람들" fill priority sizes="50vw" />
          <div className="floating"><Heart fill="var(--primary)" color="var(--primary)" size={18} /> 오늘, 새로운 취향을 만나요</div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container"><p className="eyebrow">Find your interest</p><h2 className="section-title">어떤 취향을 나누고 싶나요?</h2><CommunityExplorer items={communities} compact favoriteIds={favoriteIds} authenticated={Boolean(auth.data.user)} /></div>
    </section>
    <section className="section personalized-section">
      <div className="container">
        <div className="personalized-heading">
          <div><p className="eyebrow">For you</p><h2 className="section-title">{auth.data.user ? "회원님을 위한 추천" : "추천 커뮤니티"}</h2></div>
          <Link className="personalized-more" href="/communities">더보기 <span aria-hidden="true">›</span></Link>
        </div>
        {auth.data.user ? recommendations.length ? <div className="community-card-rail"><CommunityGrid items={recommendations.map((item)=>item.community)} favoriteIds={favoriteIds} authenticated reasons={Object.fromEntries(recommendations.map((item)=>[item.community.id,item.reasons[0]??""]))} /></div> : <div className="empty"><h3>{"\uC544\uC9C1 \uCD94\uCC9C\uD560 \uCEE4\uBBA4\uB2C8\uD2F0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</h3><p className="muted">{"\uAD00\uC2EC\uC0AC\uB97C \uB354 \uC120\uD0DD\uD574\uBCF4\uC138\uC694."}</p><Link className="btn btn-primary" href="/mypage#profile">{"\uAD00\uC2EC\uC0AC \uC218\uC815"}</Link></div> : <div className="community-card-rail"><CommunityGrid items={communities.slice(0,5)} /></div>}
      </div>
    </section>

    <section className="section" style={{ background: "var(--background-secondary)" }}>
      <div className="container"><p className="eyebrow">Recruiting now</p><h2 className="section-title">지금 모집 중인 커뮤니티</h2><p className="muted">오늘부터 가볍게 시작할 수 있는 모임이에요.</p><CommunityGrid items={communities.slice(0, 4)} favoriteIds={favoriteIds} authenticated={Boolean(auth.data.user)} /></div>
    </section>

    <section className="section">
      <div className="container"><div className="banner"><div><p className="eyebrow" style={{ color: "#c8c2ff" }}>For community hosts</p><h2>커뮤니티를 운영하고 계신가요?</h2><p>체크리스트, 일정, 참가자 관리와 공간 추천까지 운영을 가볍게.</p></div><Link className="btn btn-accent" href="/support">운영지원 알아보기</Link></div></div>
    </section>

    <section className="section" style={{ background: "var(--background-secondary)" }}>
      <div className="container"><p className="eyebrow">New communities</p><h2 className="section-title">새롭게 시작한 커뮤니티</h2><CommunityGrid items={communities.slice(8, 12)} favoriteIds={favoriteIds} authenticated={Boolean(auth.data.user)} /></div>
    </section>

    <section className="section">
      <div className="container"><h2 className="section-title">이번 주, 참여할 수 있는 모임</h2><p className="muted">날짜가 가까운 모임부터 가볍게 참여해보세요.</p><div className="grid cards">{communities.slice(2, 6).map((c) => <article className="panel weekly-community-card" key={c.id}><FavoriteButton communityId={c.id} initialFavorite={favoriteIds.includes(c.id)} authenticated={Boolean(auth.data.user)} returnTo={`/communities/${c.slug}`} /><span className="tag"><CalendarDays size={14} />{c.nextMeetingAt?new Date(c.nextMeetingAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"일정 준비 중"}</span><Link href={`/communities/${c.slug}`}><h3>{c.name}</h3><p className="muted">{c.shortDescription}</p><div className="meta"><MapPin size={14} />{c.mainRegion} · {Math.max(0,c.capacity-c.currentMembers)}자리 남음</div></Link></article>)}</div></div>
    </section>

    <section className="section" style={{ background: "var(--background-secondary)" }}>
      <div className="container"><h2 className="section-title">내 가까이에서 만나는 취향</h2><p className="muted">자주 오가는 동네에서 새로운 커뮤니티를 발견해보세요.</p><div className="category-row">{[...representativeRegions,"전체 보기"].map((r) => <Link className="category" href={`/communities?region=${encodeURIComponent(r)}`} key={r}><MapPin size={19} />{r}</Link>)}</div></div>
    </section>

    <section className="section">
      <div className="container"><div className="banner orange"><div><p className="eyebrow">For space owners</p><h2>남는 공간을<br />새로운 커뮤니티와 연결해보세요.</h2><p>유휴시간에 새로운 만남을 채우고, 지역의 단골 커뮤니티를 만들어보세요.</p></div><Link className="btn btn-primary" href="/spaces/register">공간 등록하기</Link></div></div>
    </section>
  </>;
}
