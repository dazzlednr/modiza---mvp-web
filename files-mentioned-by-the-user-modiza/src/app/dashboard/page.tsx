import Link from "next/link";
import {
  Bell, Building2, CalendarDays, CheckCircle2, ClipboardCheck,
  Compass, ListChecks, MapPin, Plus, Sparkles, Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/access";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getPersonalizedDashboard } from "@/repositories/dashboardRepository";

export const dynamic = "force-dynamic";

const applicationLabels = { pending: "검토중", approved: "승인", rejected: "거절", cancelled: "취소" } as const;
const koDate = (value: Date | string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(value));

export default async function Page() {
  const { user, profile } = await requireUser("/dashboard");
  const roles = normalizeRoles(profile?.roles);
  const communityHost = hasRole(profile, "community_host");
  const spaceHost = hasRole(profile, "space_host");
  const nickname = profile?.nickname ?? String(user.user_metadata?.nickname ?? user.email?.split("@")[0] ?? "회원");
  const data = await getPersonalizedDashboard(await createAuthServerSupabaseClient(), roles);
  const today = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "full" }).format(new Date());
  const upcomingApplications = data.myApplications.filter((item) => item.status === "approved" && item.nextMeetingAt && new Date(item.nextMeetingAt) > new Date());
  const upcomingSchedules = data.schedules.filter((item) => item.status === "upcoming" && new Date(`${item.date}T23:59:59+09:00`) >= new Date()).sort((a, b) => a.date.localeCompare(b.date));
  const checklistItems = data.checklistGroups.flatMap((group) => group.items);
  const checklistProgress = checklistItems.length ? Math.round(checklistItems.filter((item) => item.completed).length / checklistItems.length * 100) : 0;
  const pendingApplications = data.receivedApplications.filter((item) => item.status === "pending");
  const unanalyzedSpaces = data.spaces.filter((space) => !space.analysisUpdatedAt);

  return <section className="section dashboard-shell"><div className="container">
    <div className="dashboard-hero">
      <div><p className="eyebrow">My MODIZA</p><h1>안녕하세요, <strong>{nickname}님</strong></h1><p>{today} · 오늘 필요한 운영 현황을 확인해보세요.</p></div>
      <Link className="btn btn-ghost" href="/mypage"><Users size={18} /> 프로필 관리</Link>
    </div>

    <div className="dashboard-stats">
      <Link href="/mypage/applications" className="dashboard-stat"><ClipboardCheck /><span>내 신청</span><strong>{data.myApplications.length}</strong></Link>
      <Link href="/mypage/applications" className="dashboard-stat"><CalendarDays /><span>참여 예정</span><strong>{upcomingApplications.length}</strong></Link>
      <Link href={communityHost ? "/dashboard/communities" : "/role/start?role=community_host&redirect=/dashboard"} className="dashboard-stat"><Users /><span>운영중 커뮤니티</span><strong>{data.communities.filter((item) => item.status === "published").length}</strong></Link>
      <Link href={spaceHost ? "/dashboard/spaces" : "/role/start?role=space_host&redirect=/dashboard"} className="dashboard-stat"><Building2 /><span>등록 공간</span><strong>{data.spaces.length}</strong></Link>
    </div>

    <div className="dashboard-layout">
      <main className="dashboard-main">
        <section className="dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Member</p><h2>나의 참여</h2></div><Link href="/mypage/applications">전체 보기 →</Link></div>
          {data.myApplications.length ? <div className="dashboard-list">{data.myApplications.slice(0, 3).map((item) => <article key={item.id} className="dashboard-row"><div><strong>{item.communityName}</strong><p>신청일 {koDate(item.appliedAt)}{item.nextMeetingAt ? ` · 다음 모임 ${koDate(item.nextMeetingAt)}` : ""}</p></div><span className={`tag application-${item.status}`}>{applicationLabels[item.status]}</span></article>)}</div> : <div className="empty compact"><Compass size={32} /><h3>신청한 모임이 없습니다.</h3><p className="muted">취향에 맞는 지역 커뮤니티를 찾아보세요.</p><Link className="btn btn-primary" href="/communities">커뮤니티 둘러보기</Link></div>}
          <div className="placeholder-card"><Sparkles size={20} /><div><strong>관심 커뮤니티</strong><p>관심 커뮤니티 저장 기능은 곧 제공할 예정이에요.</p></div></div>
        </section>

        {communityHost && <section className="dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Community host</p><h2>커뮤니티 운영</h2></div><Link href="/dashboard/communities">내 커뮤니티 →</Link></div>
          <div className="mini-stats"><span>내 커뮤니티 <b>{data.communities.length}</b></span><span>모집중 <b>{data.communities.filter((item) => item.status === "published" && item.recruitmentStatus === "recruiting").length}</b></span><span>신청 대기 <b>{pendingApplications.length}</b></span><span>다가오는 일정 <b>{upcomingSchedules.length}</b></span></div>
          {data.communities.length ? <div className="dashboard-list">{data.communities.slice(0, 3).map((community) => <article className="dashboard-row" key={community.id}><div><strong>{community.name}</strong><p>{community.currentMembers}/{community.capacity}명 · 다음 일정 {community.nextMeetingAt ? koDate(community.nextMeetingAt) : "미정"}</p></div><Link className="btn btn-ghost btn-small" href={`/dashboard/communities/${community.id}/edit`}>관리</Link></article>)}</div> : <div className="empty compact"><Users size={32} /><h3>아직 운영 중인 커뮤니티가 없습니다.</h3><Link className="btn btn-primary" href="/communities/register">첫 커뮤니티 만들기</Link></div>}
          <div className="progress-card">
            <div><strong>체크리스트 진행률</strong><span>{checklistProgress}%</span></div>
            <div className="progress-track"><i style={{ width: `${checklistProgress}%` }} /></div>
            <div className="progress-actions">
              <small className="muted">할 일을 추가하고 완료 상태를 관리할 수 있어요.</small>
              <Link className="btn btn-ghost btn-small" href="/dashboard/checklists"><ListChecks /> 체크리스트 관리</Link>
            </div>
          </div>
          {pendingApplications.length > 0 && <div><h3>최근 신청자</h3><div className="dashboard-list">{pendingApplications.slice(0, 3).map((item) => <div className="dashboard-row" key={item.id}><div><strong>{item.applicantName}</strong><p>{item.communityName} · {koDate(item.appliedAt)}</p></div><Link href="/dashboard/applications">확인</Link></div>)}</div></div>}
        </section>}

        {spaceHost && <section className="dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Space host</p><h2>공간 운영</h2></div><Link href="/dashboard/spaces">내 공간 →</Link></div>
          <div className="mini-stats"><span>내 공간 <b>{data.spaces.length}</b></span><span>공개중 <b>{data.spaces.filter((item) => item.status === "active").length}</b></span><span>비공개 <b>{data.spaces.filter((item) => item.status !== "active").length}</b></span><span>AI 분석 필요 <b>{unanalyzedSpaces.length}</b></span></div>
          {data.spaces.length ? <div className="dashboard-list">{data.spaces.slice(0, 3).map((space) => <article className="dashboard-row" key={space.id}><div><strong>{space.name}</strong><p>{space.status === "active" ? "공개중" : "비공개"} · 최근 수정 {koDate(space.updatedAt)} · {space.analysisUpdatedAt ? "AI 분석 완료" : "AI 분석 필요"}</p></div><Link className="btn btn-ghost btn-small" href={`/dashboard/spaces/${space.id}/edit`}>{space.analysisUpdatedAt ? "관리" : "AI 분석"}</Link></article>)}</div> : <div className="empty compact"><Building2 size={32} /><h3>등록한 공간이 없습니다.</h3><Link className="btn btn-primary" href="/spaces/register">공간 등록하기</Link></div>}
        </section>}
      </main>

      <aside className="dashboard-side">
        <section className="panel"><div className="section-heading"><h2>빠른 액션</h2><Plus size={20} /></div><div className="quick-actions">
          <Link href="/communities/register"><Users />커뮤니티 만들기</Link><Link href="/spaces/register"><Building2 />공간 등록</Link><Link href="/support"><Compass />운영지원</Link><Link href="/dashboard/spaces/recommend"><MapPin />공간 추천</Link><Link href="/mypage/applications"><ClipboardCheck />내 신청</Link>{communityHost && <Link href="/dashboard/checklists"><ListChecks />체크리스트</Link>}{spaceHost && <Link href="/dashboard/spaces"><Building2 />내 공간</Link>}{communityHost && <Link href="/dashboard/communities"><Users />내 커뮤니티</Link>}
        </div></section>
        <section className="panel"><div className="section-heading"><h2>최근 활동</h2><Bell size={20} /></div><div className="activity-list"><p><CheckCircle2 /> 신청 상태 변경 소식을 이곳에서 확인할 수 있어요.</p><p><Sparkles /> 공간 AI 분석 결과 알림이 표시될 예정이에요.</p><p><Users /> 새 신청자 알림이 표시될 예정이에요.</p></div><small className="muted">실시간 알림은 다음 단계에서 연결됩니다.</small></section>
      </aside>
    </div>
  </div></section>;
}
