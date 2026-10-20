import Image from "next/image";
import Link from "next/link";
import {
  Bell, Building2, CalendarDays, CheckCircle2, ClipboardCheck,
  Compass, Heart, Pencil, Plus, Sparkles, Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/access";
import { hasRole } from "@/lib/auth/roles";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import {
  getCommunityHostDashboard,
  getMemberDashboard,
  getSpaceHostDashboard,
} from "@/repositories/dashboardRepository";
import { CommunityGrid } from "@/components/community";
import { CommunityOperationsDashboard } from "@/components/dashboard/CommunityOperationsDashboard";

export const dynamic = "force-dynamic";

type DashboardView = "member" | "community" | "space";
type MemberData = Awaited<ReturnType<typeof getMemberDashboard>>;
type CommunityData = Awaited<ReturnType<typeof getCommunityHostDashboard>>;
type SpaceData = Awaited<ReturnType<typeof getSpaceHostDashboard>>;

const applicationLabels = { pending: "검토중", approved: "승인", rejected: "거절", cancelled: "취소" } as const;
const koDate = (value: Date | string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(value));

function normalizeView(value?: string): DashboardView {
  return value === "community" || value === "space" ? value : "member";
}

function DashboardTabs({ view, communityHost, spaceHost }: { view: DashboardView; communityHost: boolean; spaceHost: boolean }) {
  return <nav className="dashboard-role-tabs" aria-label="대시보드 역할 전환">
    <Link className={view === "member" ? "active" : ""} aria-current={view === "member" ? "page" : undefined} href="/dashboard?view=member"><Compass />내 활동</Link>
    {communityHost && <Link className={view === "community" ? "active" : ""} aria-current={view === "community" ? "page" : undefined} href="/dashboard?view=community"><Users />모임 운영 관리</Link>}
    {spaceHost && <Link className={view === "space" ? "active" : ""} aria-current={view === "space" ? "page" : undefined} href="/dashboard?view=space"><Building2 />공간 운영</Link>}
  </nav>;
}

function QuickActions({ view }: { view: DashboardView }) {
  return <section className="panel"><div className="section-heading"><h2>빠른 실행</h2><Plus size={20} /></div><div className="quick-actions">
    {view === "space" && <><Link href="/spaces/register"><Building2 />공간 등록</Link><Link href="/dashboard/spaces"><Building2 />내 공간 관리</Link><Link href="/dashboard/spaces"><Pencil />공간 정보 수정</Link><Link href="/dashboard/spaces/requests"><CalendarDays />이용 요청 관리</Link></>}
  </div></section>;
}

function MemberDashboard({ data }: { data: MemberData }) {
  const favoriteIds = data.favorites.map((item) => item.communityId);
  return <main className="dashboard-main member-activity">
    <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">My activity</p><h2>내가 신청한 모임</h2></div><Link href="/mypage/applications">전체 보기 →</Link></div>
      {data.applications.length ? <div className="dashboard-list application-card-list">{data.applications.slice(0, 4).map((item) => {
        const card = <article className="dashboard-row application-card"><div className="application-card-image"><Image src={item.communityThumbnailUrl || "/community-placeholder.svg"} alt="" fill sizes="72px" /></div><div><strong>{item.communityName}</strong><p>{item.nextMeetingAt ? `일정 ${koDate(item.nextMeetingAt)}` : `신청일 ${koDate(item.appliedAt)}`}</p></div><span className={`tag application-${item.status}`}>{applicationLabels[item.status]}</span></article>;
        return item.communitySlug ? <Link className="application-card-link" href={`/communities/${item.communitySlug}`} key={item.id}>{card}</Link> : <div key={item.id}>{card}</div>;
      })}</div> : <div className="empty compact"><Compass size={32} /><h3>아직 신청한 모임이 없어요.</h3><p className="muted">취향에 맞는 모임을 찾아보세요.</p><Link className="btn btn-primary" href="/communities">모임 둘러보기</Link></div>}
    </section>
    <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Favorites</p><h2>관심 모임</h2></div><Link href="/mypage/favorites">전체 보기 →</Link></div>
      {data.favorites.length ? <CommunityGrid items={data.favorites.slice(0, 3).map((item) => item.community)} favoriteIds={favoriteIds} authenticated /> : <div className="empty compact"><Heart size={32} /><h3>아직 저장한 모임이 없어요.</h3><Link className="btn btn-ghost" href="/communities">관심 모임 찾기</Link></div>}
    </section>
    <section className="dashboard-section dashboard-recommendation-section"><div className="section-heading"><div><p className="eyebrow">For you</p><h2>회원님을 위한 추천</h2></div><Link href="/communities">더 보기 →</Link></div>
      {data.recommendations.length ? <div className="dashboard-recommendation-rail"><CommunityGrid className="dashboard-recommendation-grid" variant="dashboard" items={data.recommendations.map((item) => item.community)} favoriteIds={favoriteIds} authenticated /></div> : <div className="empty compact"><Sparkles size={32} /><p>공개된 모임이 등록되면 이곳에서 추천해 드려요.</p><Link className="btn btn-ghost" href="/mypage#profile">관심사 수정</Link></div>}
    </section>
  </main>;
}

function CommunityHostDashboard({ data, nowIso }: { data: CommunityData; nowIso: string }) {
  return <CommunityOperationsDashboard data={data} nowIso={nowIso} />;
}

function SpaceHostDashboard({ data }: { data: SpaceData }) {
  const active = data.spaces.filter((item) => item.status === "approved");
  const drafts = data.spaces.filter((item) => item.status === "draft");
  const inactive = data.spaces.filter((item) => item.status === "inactive");
  return <>
    <nav className="dashboard-role-tabs" aria-label="공간 운영 관리">
      <Link href="/dashboard/spaces"><Building2 />내 공간</Link>
      <Link href="/dashboard/spaces/requests"><ClipboardCheck />이용 요청 관리</Link>
      <Link href="/dashboard/spaces/reservations"><CalendarDays />예약 관리</Link>
    </nav>
    <div className="dashboard-stats"><Link href="/dashboard/spaces" className="dashboard-stat"><Building2 /><span>등록 공간 수</span><strong>{data.spaces.length}</strong></Link><Link href="/dashboard/spaces" className="dashboard-stat"><CheckCircle2 /><span>공개 중인 공간</span><strong>{active.length}</strong></Link><Link href="/dashboard/spaces" className="dashboard-stat"><Pencil /><span>작성 중인 공간</span><strong>{drafts.length}</strong></Link><Link href="/dashboard/spaces" className="dashboard-stat"><Bell /><span>비공개 공간</span><strong>{inactive.length}</strong></Link></div>
    <div className="dashboard-layout"><main className="dashboard-main"><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Space host</p><h2>내가 등록한 공간</h2></div><Link href="/dashboard/spaces">전체 관리 →</Link></div><div className="host-verification-note"><CheckCircle2 /><div><strong>공간 운영자 인증 완료</strong><p>내가 소유한 공간의 공개 상태와 최근 수정 정보를 확인할 수 있습니다.</p></div></div>
      {data.spaces.length ? <div className="dashboard-list dashboard-list-spaced">{data.spaces.slice(0, 5).map((space) => <article className="dashboard-row" key={space.id}><div><strong>{space.name}</strong><p>{space.status === "approved" ? "승인·공개 중" : space.status === "pending" ? "심사 중" : space.status === "revision_requested" ? "보완 요청" : space.status === "draft" ? "작성 중" : "비공개"} · 최근 수정 {koDate(space.updatedAt)}</p></div><Link className="btn btn-ghost btn-small" href={`/dashboard/spaces/${space.id}/edit`}>관리</Link></article>)}</div> : <div className="empty compact"><Building2 size={32} /><h3>아직 등록한 공간이 없어요.</h3><Link className="btn btn-primary" href="/spaces/register">공간 등록하기</Link></div>}
    </section></main><aside className="dashboard-side"><QuickActions view="space" /><section className="panel"><h2>공간 상태</h2><div className="activity-list"><p><CheckCircle2 />공개 중 {active.length}개</p><p><Pencil />작성 중 {drafts.length}개</p><p><Building2 />비공개 {inactive.length}개</p></div></section></aside></div>
  </>;
}

function RoleStartNotice({ view }: { view: "community" | "space" }) {
  const community = view === "community";
  return <div className="empty dashboard-role-empty">{community ? <Users size={42} /> : <Building2 size={42} />}<h2>{community ? "모임 운영자 권한이 필요해요." : "공간 운영자 인증이 필요해요."}</h2><p className="muted">{community ? "운영자 소개를 등록하면 모임 운영 화면을 이용할 수 있어요." : "공간 운영자 인증이 완료되면 내 공간 관리 화면을 이용할 수 있어요."}</p><Link className="btn btn-primary" href={community ? "/community-host/start?redirect=%2Fdashboard%3Fview%3Dcommunity" : "/space-host/apply"}>{community ? "모임 운영 시작하기" : "공간 운영자 등록"}</Link></div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user, profile } = await requireUser("/dashboard");
  const requestedView = normalizeView((await searchParams).view);
  const communityHost = hasRole(profile, "community_host");
  const spaceHost = hasRole(profile, "space_host");
  const nickname = profile?.nickname ?? String(user.user_metadata?.nickname ?? user.email?.split("@")[0] ?? "회원");
  const today = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "full" }).format(new Date());
  const db = await createAuthServerSupabaseClient();
  const viewLabel = requestedView === "member" ? "내 활동" : requestedView === "community" ? "모임 운영 관리" : "공간 운영";

  let content: React.ReactNode;
  if (requestedView === "community" && !communityHost) content = <RoleStartNotice view="community" />;
  else if (requestedView === "space" && !spaceHost) content = <RoleStartNotice view="space" />;
  else if (requestedView === "community") content = <CommunityHostDashboard data={await getCommunityHostDashboard(db)} nowIso={new Date().toISOString()} />;
  else if (requestedView === "space") content = <SpaceHostDashboard data={await getSpaceHostDashboard(db)} />;
  else content = <MemberDashboard data={await getMemberDashboard(db, profile)} />;

  return <section className="section dashboard-shell"><div className="container">
    <div className="dashboard-hero"><div><p className="eyebrow">{viewLabel}</p><h1>안녕하세요, <strong>{nickname}님</strong></h1><p>{today} · {requestedView === "member" ? "나의 참여와 관심 활동을 확인해보세요." : requestedView === "community" ? "모임 운영에 필요한 현황을 확인해보세요." : "등록한 공간의 상태와 정보를 확인해보세요."}</p></div><Link className="btn btn-ghost" href="/mypage"><Users size={18} />프로필 관리</Link></div>
    <DashboardTabs view={requestedView} communityHost={communityHost} spaceHost={spaceHost} />
    {content}
  </div></section>;
}
