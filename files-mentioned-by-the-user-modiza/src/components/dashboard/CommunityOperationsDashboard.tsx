"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Clock3,
  ListChecks,
  MapPin,
  MessageCircle,
  Plus,
  Users,
} from "lucide-react";
import type { Community, CommunityApplication } from "@/types/community";
import type { ChecklistGroup, Schedule } from "@/types/operator";
import { AnnouncementComposer } from "@/components/operations/AnnouncementComposer";
import { MapViewButton } from "@/components/common/MapViewButton";

type PlaceSummary = {
  id: string;
  name: string;
  slug: string;
  address: string;
  addressDetail: string | null;
};

export type CommunityOperationsData = {
  communities: Community[];
  applications: CommunityApplication[];
  schedules: Schedule[];
  checklistGroups: ChecklistGroup[];
  placeNames: Record<string, string>;
  places: Record<string, PlaceSummary>;
  openChatCommunityIds: string[];
  errors: Record<string, string>;
};

type OperationTask = {
  id: string;
  priority: number;
  title: string;
  description: string;
  communityId: string;
  href?: string;
  actionLabel: string;
  announcement?: { scheduleId?: string; kind: "하루 전 안내" | "당일 안내" };
};

const applicationLabels = {
  pending: "승인 대기",
  approved: "참가 확정",
  rejected: "참가 거절",
  cancelled: "신청 취소",
} as const;

const communityStatusLabels = {
  draft: "작성 중",
  published: "운영 중",
  ended: "종료",
  inactive: "비공개",
} as const;

function koDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value));
}

function dateDiff(date: string, nowIso: string) {
  const target = new Date(`${date.slice(0, 10)}T00:00:00+09:00`).getTime();
  const now = new Date(nowIso);
  const today = new Date(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now) + "T00:00:00+09:00").getTime();
  return Math.round((target - today) / 86_400_000);
}

function dayLabel(date: string, nowIso: string) {
  const diff = dateDiff(date, nowIso);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff > 1) return `D-${diff}`;
  return "지난 일정";
}

function recommendationHref(community: Community) {
  const params = new URLSearchParams({
    communityId: community.id,
    meetingType: community.category,
    capacity: String(community.capacity),
    region: community.detailedRegion,
    budget: String(community.budgetMax || community.participationFee || 0),
  });
  if (community.nextMeetingAt) params.set("date", community.nextMeetingAt.slice(0, 10));
  return `/dashboard/spaces/recommend?${params.toString()}`;
}

function SectionError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="dashboard-inline-error" role="alert"><AlertCircle /><span>{message}</span><Link href="/dashboard?view=community">다시 시도</Link></div>;
}

export function CommunityOperationsDashboard({
  data,
  nowIso,
}: {
  data: CommunityOperationsData;
  nowIso: string;
}) {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const published = data.communities.filter((item) => item.status === "published");
  const communityById = useMemo(() => new Map(data.communities.map((item) => [item.id, item])), [data.communities]);
  const approvedByCommunity = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data.applications) if (item.status === "approved") map.set(item.communityId, (map.get(item.communityId) ?? 0) + 1);
    return map;
  }, [data.applications]);
  const pendingByCommunity = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data.applications) if (item.status === "pending") map.set(item.communityId, (map.get(item.communityId) ?? 0) + 1);
    return map;
  }, [data.applications]);
  const checklistByCommunity = useMemo(() => {
    const map = new Map<string, ChecklistGroup[]>();
    for (const group of data.checklistGroups) {
      if (!group.communityId) continue;
      map.set(group.communityId, [...(map.get(group.communityId) ?? []), group]);
    }
    return map;
  }, [data.checklistGroups]);
  const incompleteByCommunity = useMemo(() => {
    const map = new Map<string, number>();
    for (const [communityId, groups] of checklistByCommunity) {
      map.set(communityId, groups.flatMap((group) => group.items).filter((item) => !item.completed).length);
    }
    return map;
  }, [checklistByCommunity]);
  const openChats = useMemo(() => new Set(data.openChatCommunityIds), [data.openChatCommunityIds]);
  const upcomingSchedules = useMemo(() => data.schedules
    .filter((item) => item.status === "upcoming" && dateDiff(item.date, nowIso) >= 0)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), [data.schedules, nowIso]);
  const nextScheduleByCommunity = useMemo(() => {
    const map = new Map<string, Schedule>();
    for (const schedule of upcomingSchedules) if (schedule.communityId && !map.has(schedule.communityId)) map.set(schedule.communityId, schedule);
    return map;
  }, [upcomingSchedules]);

  const tasks = useMemo(() => {
    const result: OperationTask[] = [];
    for (const community of published) {
      const pending = pendingByCommunity.get(community.id) ?? 0;
      const schedule = nextScheduleByCommunity.get(community.id);
      const incomplete = incompleteByCommunity.get(community.id) ?? 0;
      if (pending > 0) result.push({
        id: `applications-${community.id}`,
        priority: schedule && dateDiff(schedule.date, nowIso) <= 1 ? 110 : 90,
        title: `${community.name} 신청 ${pending}건을 확인해주세요`,
        description: "승인 대기 중인 신청을 확인하고 참가 여부를 결정할 수 있어요.",
        communityId: community.id,
        href: `/dashboard/applications?communityId=${community.id}&status=pending`,
        actionLabel: "신청 확인",
      });
      if (!openChats.has(community.id)) result.push({
        id: `chat-${community.id}`,
        priority: (approvedByCommunity.get(community.id) ?? 0) > 0 ? 100 : 64,
        title: `${community.name} 오픈채팅방을 등록해주세요`,
        description: "참가 확정 이용자에게만 안전하게 입장 링크가 공개됩니다.",
        communityId: community.id,
        href: `/communities/${encodeURIComponent(community.slug)}/open-chat/setup`,
        actionLabel: "오픈채팅 등록",
      });
      if (!community.linkedSpaceId) result.push({
        id: `place-${community.id}`,
        priority: schedule && dateDiff(schedule.date, nowIso) <= 3 ? 96 : 60,
        title: `${community.name} 모임 장소가 정해지지 않았어요`,
        description: schedule ? `${koDate(schedule.date)} 일정 전에 장소를 확정해주세요.` : "운영 조건에 맞는 장소를 추천받을 수 있어요.",
        communityId: community.id,
        href: recommendationHref(community),
        actionLabel: "공간 찾기",
      });
      if (schedule && dateDiff(schedule.date, nowIso) <= 7 && incomplete > 0) result.push({
        id: `checklist-${community.id}`,
        priority: 80 - dateDiff(schedule.date, nowIso),
        title: `${community.name} 준비 항목 ${incomplete}개가 남았어요`,
        description: `${dayLabel(schedule.date, nowIso)} 일정 전 체크리스트를 마무리해주세요.`,
        communityId: community.id,
        href: `/dashboard/checklists?communityId=${community.id}`,
        actionLabel: "체크리스트 확인",
      });
      if (schedule && dateDiff(schedule.date, nowIso) >= 0 && dateDiff(schedule.date, nowIso) <= 1) result.push({
        id: `announcement-${schedule.id}`,
        priority: dateDiff(schedule.date, nowIso) === 0 ? 105 : 88,
        title: `${community.name} ${dateDiff(schedule.date, nowIso) === 0 ? "당일" : "하루 전"} 안내를 준비해보세요`,
        description: "모디자가 초안을 제안하면 내용을 수정해 참가자 채널에 복사할 수 있어요.",
        communityId: community.id,
        actionLabel: "공지 작성",
        announcement: { scheduleId: schedule.id, kind: dateDiff(schedule.date, nowIso) === 0 ? "당일 안내" : "하루 전 안내" },
      });
    }
    return result.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
  }, [approvedByCommunity, incompleteByCommunity, nextScheduleByCommunity, nowIso, openChats, pendingByCommunity, published]);

  const allChecklistItems = data.checklistGroups.flatMap((group) => group.items);
  const incompleteItems = data.checklistGroups.flatMap((group) =>
    group.items.filter((item) => !item.completed).map((item) => ({
      ...item,
      groupTitle: group.title,
      communityId: group.communityId,
      communityName: group.communityId ? communityById.get(group.communityId)?.name ?? "커뮤니티" : "커뮤니티",
    })),
  );
  const checklistProgress = allChecklistItems.length
    ? Math.round((allChecklistItems.length - incompleteItems.length) / allChecklistItems.length * 100)
    : 0;
  const nextSevenDays = upcomingSchedules.filter((item) => dateDiff(item.date, nowIso) <= 7);
  const recentApplications = [...data.applications].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.appliedAt.localeCompare(a.appliedAt);
  }).slice(0, 5);
  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, 3);
  const firstMissingChat = published.find((item) => !openChats.has(item.id));
  const firstMissingPlace = published.find((item) => !item.linkedSpaceId);

  return <div className="community-operations">
    <section className="dashboard-section operations-tasks">
      <div className="section-heading">
        <div><p className="eyebrow">오늘의 할 일</p><h2>지금 처리하면 좋은 운영 업무 <span>{tasks.length}</span></h2></div>
        {tasks.length > 3 && <button type="button" className="text-button" onClick={() => setShowAllTasks((value) => !value)}>
          {showAllTasks ? <><ChevronUp />접기</> : <><ChevronDown />전체 할 일 보기</>}
        </button>}
      </div>
      <SectionError message={data.errors.applications || data.errors.openChats} />
      {visibleTasks.length ? <div className="operation-task-list">{visibleTasks.map((task, index) => <article className="operation-task" key={task.id}>
        <span className={`operation-priority priority-${index < 2 ? "high" : "normal"}`}>{index < 2 ? "우선" : "확인"}</span>
        <div><strong>{task.title}</strong><p>{task.description}</p></div>
        {task.announcement
          ? <AnnouncementComposer communities={data.communities} schedules={data.schedules} initialCommunityId={task.communityId} initialScheduleId={task.announcement.scheduleId} initialKind={task.announcement.kind} label={task.actionLabel} className="btn btn-primary btn-small" />
          : <Link className="btn btn-primary btn-small" href={task.href!}>{task.actionLabel}</Link>}
      </article>)}</div> : <div className="operations-clear"><CheckCircle2 /><div><strong>지금 바로 처리할 긴급 업무가 없어요.</strong><p>새로운 신청이나 가까운 일정이 생기면 우선순위대로 알려드릴게요.</p></div></div>}
    </section>

    <div className="dashboard-stats">
      <Link href="/dashboard/communities" className="dashboard-stat"><Users /><span>운영 중인 커뮤니티</span><strong>{published.length}개</strong></Link>
      <Link href="/dashboard/applications?status=pending" className="dashboard-stat"><ClipboardCheck /><span>승인 대기 신청</span><strong>{data.applications.filter((item) => item.status === "pending").length}건</strong></Link>
      <Link href="/dashboard/schedules" className="dashboard-stat"><CalendarDays /><span>7일 내 일정</span><strong>{nextSevenDays.length}개</strong></Link>
      <Link href="/dashboard/checklists" className="dashboard-stat"><ListChecks /><span>미완료 준비</span><strong>{incompleteItems.length}개</strong></Link>
    </div>

    <section className="dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">운영 커뮤니티</p><h2>내가 운영하는 커뮤니티</h2></div><Link href="/dashboard/communities">전체 관리 →</Link></div>
      <SectionError message={data.errors.communities} />
      {data.communities.length ? <div className="operations-community-list">{data.communities.map((community) => {
        const schedule = nextScheduleByCommunity.get(community.id);
        const approved = approvedByCommunity.get(community.id) ?? 0;
        const pending = pendingByCommunity.get(community.id) ?? 0;
        const incomplete = incompleteByCommunity.get(community.id) ?? 0;
        const place = community.linkedSpaceId ? data.places[community.linkedSpaceId] : undefined;
        const badges: string[] = [];
        if (pending) badges.push(`신청 ${pending}건 대기`);
        if (schedule && dateDiff(schedule.date, nowIso) <= 3) badges.push("모임 임박");
        if (!openChats.has(community.id)) badges.push("오픈채팅 미등록");
        if (!community.linkedSpaceId) badges.push("장소 미확정");
        if (!badges.length && incomplete) badges.push("준비 중");
        const unfinished = pending + incomplete + (!openChats.has(community.id) ? 1 : 0) + (!community.linkedSpaceId ? 1 : 0);
        return <article className="operations-community-card" key={community.id}>
          <div className="operations-community-head">
            <div><span className={`tag community-${community.status}`}>{communityStatusLabels[community.status]}</span><h3>{community.name}</h3></div>
            <div className="priority-badges">{badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}</div>
          </div>
          <div className="operations-community-metrics">
            <span><Users />참가 확정 <b>{approved}/{community.capacity}명</b></span>
            <span><CalendarDays />{schedule ? `${koDate(schedule.date)} ${schedule.startTime}` : "다음 일정 미정"}</span>
            <span><MapPin />{place?.name ?? schedule?.location ?? "장소 미확정"}</span>
            <span><ListChecks />남은 운영 업무 <b>{unfinished}개</b></span>
          </div>
          <div className="operations-community-actions">
            <Link className="btn btn-ghost btn-small" href={`/dashboard/communities/${community.id}/edit`}>커뮤니티 관리</Link>
            {pending > 0 && <Link className="btn btn-ghost btn-small" href={`/dashboard/applications?communityId=${community.id}&status=pending`}>신청 확인</Link>}
            {!community.linkedSpaceId && <Link className="btn btn-ghost btn-small" href={recommendationHref(community)}>공간 찾기</Link>}
            {!openChats.has(community.id) && <Link className="btn btn-ghost btn-small" href={`/communities/${encodeURIComponent(community.slug)}/open-chat/setup`}><MessageCircle />오픈채팅 등록</Link>}
            {place && <MapViewButton address={[place.address, place.addressDetail].filter(Boolean).join(" ")} placeName={place.name} />}
          </div>
        </article>;
      })}</div> : <div className="empty compact"><Users /><h3>아직 운영 중인 커뮤니티가 없어요.</h3><p className="muted">첫 커뮤니티를 만들면 운영 업무를 이곳에서 한눈에 관리할 수 있어요.</p><Link className="btn btn-primary" href="/communities/register">첫 커뮤니티 만들기</Link></div>}
    </section>

    <section className="dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">준비 현황</p><h2>운영 준비 체크리스트</h2></div><Link href="/dashboard/checklists">전체 체크리스트 →</Link></div>
      <SectionError message={data.errors.checklists} />
      <div className="progress-card operations-progress">
        <div><strong>전체 진행률</strong><span>{checklistProgress}%</span></div>
        <div className="progress-track"><i style={{ width: `${checklistProgress}%` }} /></div>
        <small className="muted">완료 {allChecklistItems.length - incompleteItems.length}개 · 미완료 {incompleteItems.length}개</small>
      </div>
      {incompleteItems.length ? <div className="dashboard-list">{incompleteItems.slice(0, 3).map((item) => <article className="dashboard-row" key={item.id}>
        <div><strong>{item.title}</strong><p>{item.communityName} · {item.groupTitle}{item.dueDate ? ` · ${koDate(item.dueDate)}까지` : ""}</p></div>
        <Link href={`/dashboard/checklists?communityId=${item.communityId ?? ""}`}>확인</Link>
      </article>)}</div> : <div className="operations-clear compact"><CheckCircle2 /><div><strong>{allChecklistItems.length ? "모든 준비 항목을 완료했어요." : "아직 만든 체크리스트가 없어요."}</strong><p>{allChecklistItems.length ? "다가오는 일정을 차분히 준비해보세요." : "커뮤니티별 준비 항목을 만들어 운영을 시작해보세요."}</p></div></div>}
    </section>

    <section className="dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">다가오는 일정</p><h2>다음 모임 준비</h2></div><Link href="/dashboard/schedules">일정 관리 →</Link></div>
      <SectionError message={data.errors.schedules} />
      {upcomingSchedules.length ? <div className="schedule-operation-grid">{upcomingSchedules.slice(0, 5).map((schedule) => {
        const community = schedule.communityId ? communityById.get(schedule.communityId) : undefined;
        const incomplete = schedule.communityId ? incompleteByCommunity.get(schedule.communityId) ?? 0 : 0;
        const place = community?.linkedSpaceId ? data.places[community.linkedSpaceId] : undefined;
        const prep = !schedule.location && !place ? "장소 확인 필요" : incomplete ? `준비 ${incomplete}개 남음` : "준비 완료";
        return <article className="schedule-operation-card" key={schedule.id}>
          <div className="schedule-day"><b>{dayLabel(schedule.date, nowIso)}</b><span>{koDate(schedule.date)}</span></div>
          <div><h3>{schedule.communityName}</h3><p>{schedule.startTime}{schedule.endTime ? `–${schedule.endTime}` : ""} · {place?.name ?? schedule.location ?? "장소 미정"}</p><span className={`tag ${incomplete ? "application-pending" : "application-approved"}`}>{prep}</span></div>
          <div className="schedule-count"><Users /><b>{schedule.communityId ? approvedByCommunity.get(schedule.communityId) ?? 0 : 0}명</b><small>참가 확정</small></div>
        </article>;
      })}</div> : <div className="empty compact"><CalendarDays /><h3>다가오는 일정이 없어요.</h3><Link className="btn btn-ghost" href="/dashboard/schedules">일정 만들기</Link></div>}
    </section>

    <section className="dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">최근 신청</p><h2>참여 신청 현황</h2></div><Link href="/dashboard/applications">전체 신청 →</Link></div>
      <SectionError message={data.errors.applications} />
      {recentApplications.length ? <div className="dashboard-list">{recentApplications.map((item) => <article className="dashboard-row" key={item.id}>
        <div><strong>{item.applicantName}</strong><p>{item.communityName} · {koDate(item.appliedAt)}</p></div>
        <div className="application-row-action"><span className={`tag application-${item.status}`}>{applicationLabels[item.status]}</span><Link href={`/dashboard/applications?communityId=${item.communityId}`}>확인</Link></div>
      </article>)}</div> : <div className="empty compact"><ClipboardCheck /><h3>아직 참여 신청이 없어요.</h3><p className="muted">새 신청이 들어오면 승인 대기 순으로 보여드릴게요.</p></div>}
    </section>

    <section className="dashboard-section operations-quick-section">
      <div className="section-heading"><div><p className="eyebrow">빠른 실행</p><h2>바로 이어서 처리하기</h2></div><Plus /></div>
      <div className="operations-primary-actions">
        {firstMissingChat
          ? <Link className="btn btn-primary" href={`/communities/${encodeURIComponent(firstMissingChat.slug)}/open-chat/setup`}><MessageCircle />오픈채팅 등록</Link>
          : <AnnouncementComposer communities={data.communities} schedules={data.schedules} label="공지 작성" className="btn btn-primary" />}
        {firstMissingPlace
          ? <Link className="btn btn-primary" href={recommendationHref(firstMissingPlace)}><MapPin />공간 찾기</Link>
          : <Link className="btn btn-primary" href="/dashboard/applications?status=pending"><ClipboardCheck />신청 확인</Link>}
      </div>
      <div className="operations-secondary-actions">
        <Link href="/dashboard/checklists"><ListChecks />체크리스트 관리</Link>
        <Link href="/dashboard/schedules"><Clock3 />일정 관리</Link>
        <Link href="/communities/register"><Users />새 커뮤니티 만들기</Link>
        <AnnouncementComposer communities={data.communities} schedules={data.schedules} label="참가자 공지" className="operations-link-button" />
      </div>
    </section>
  </div>;
}
