"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardCheck, ListChecks, MapPin, Pencil, Users } from "lucide-react";
import { OpenChatManager } from "@/components/community/OpenChatManager";
import type { Community, CommunityStatus, RecruitmentStatus } from "@/types/community";

const stateLabel = (community: Community) =>
  community.status === "draft" ? "임시 저장" :
  community.status === "ended" ? "운영 종료" :
  community.status === "inactive" ? "비공개" :
  community.recruitmentStatus === "recruiting" ? "모집 중" :
  community.recruitmentStatus === "closed" ? "모집 마감" : "모집 예정";

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "미정";

function placeAction(community: Community) {
  const request = community.placeRequest;
  if (request?.status === "pending" || request?.status === "approved") {
    return { label: "신청 내역 보기", href: `/dashboard/communities/space-requests?requestId=${request.id}` };
  }
  if (request?.status === "negotiating") {
    return { label: "이 공간에 협의 요청", href: `/dashboard/communities/space-requests?requestId=${request.id}` };
  }
  if (request?.status === "rejected" || request?.status === "cancelled") {
    return { label: "다른 공간 찾기", href: `/dashboard/spaces/recommend?communityId=${community.id}` };
  }
  if (community.linkedSpaceId || request?.status === "confirmed") {
    return {
      label: "장소 정보 보기",
      href: request?.spaceSlug
        ? `/spaces/${request.spaceSlug}?requestCommunityId=${community.id}`
        : `/dashboard/communities/space-requests?requestId=${request?.id ?? ""}`,
    };
  }
  return { label: "공간 찾기", href: `/dashboard/spaces/recommend?communityId=${community.id}` };
}

export default function Page() {
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/communities", { cache: "no-store" });
    if (response.ok) setItems(await response.json());
    else setError("커뮤니티 목록을 불러오지 못했어요.");
    setLoading(false);
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, []);

  async function patch(id: string, value: { status?: CommunityStatus; recruitmentStatus?: RecruitmentStatus }) {
    const response = await fetch(`/api/communities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!response.ok) setError((await response.json()).message);
    else await load();
  }

  async function remove(id: string) {
    if (!confirm("이 커뮤니티를 비공개 상태로 전환할까요?")) return;
    await fetch(`/api/communities/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <section className="section"><div className="container">내 커뮤니티를 불러오는 중...</div></section>;

  return <section className="section dashboard-shell"><div className="container">
    <div className="section-heading page-heading">
      <div><p className="eyebrow">My communities</p><h1 className="section-title">내 커뮤니티</h1><p className="muted">현재 로그인한 계정이 운영하는 커뮤니티만 표시됩니다.</p></div>
      <div className="management-actions"><Link className="btn btn-ghost" href="/dashboard/communities/space-requests">공간 요청 내역</Link><Link className="btn btn-primary" href="/communities/register">새 커뮤니티 만들기</Link></div>
    </div>
    {error && <p className="error-summary">{error}</p>}
    {items.length ? <div className="management-list">
      {items.map((community) => <article className="management-card community-management-card" key={community.id}>
        <div className="management-thumb community-management-thumb"><Image src={community.thumbnailUrl || "/community-placeholder.svg"} alt={community.name} fill sizes="(max-width:700px) 100vw, (max-width:1020px) 32vw, 360px" /></div>
        <div className="management-content community-management-content">
          <div className="section-heading"><div><span className="tag">{stateLabel(community)}</span><h2>{community.name}</h2></div><small className="muted">최근 수정 {new Date(community.updatedAt).toLocaleDateString("ko-KR")}</small></div>
          <div className="management-metrics">
            <span><Users />현재 인원 <b>{community.currentMembers}/{community.capacity}</b></span>
            <span><ClipboardCheck />신청 대기 <b>{community.pendingApplicationCount ?? 0}</b></span>
            <span><CalendarDays />다음 일정 <b>{date(community.nextMeetingAt)}</b></span>
          </div>
          <div className="management-actions community-management-actions">
            <Link className="btn btn-primary btn-small" href={placeAction(community).href}><MapPin />{placeAction(community).label}</Link>
            <Link className="btn btn-ghost btn-small" href={`/dashboard/communities/${community.id}/edit`}><Pencil />수정</Link>
            <Link className="btn btn-ghost btn-small" href={`/dashboard/applications?communityId=${community.id}`}><ClipboardCheck />신청자</Link>
            <Link className="btn btn-ghost btn-small" href="/dashboard/checklists"><ListChecks />체크리스트</Link>
            <Link className="btn btn-ghost btn-small" href="/dashboard/schedules"><CalendarDays />일정</Link>
            {community.status === "draft" && <button className="btn btn-primary btn-small" onClick={() => void patch(community.id, { status: "published" })}>공개</button>}
            {community.status === "published" && <button className="btn btn-ghost btn-small" onClick={() => void patch(community.id, { status: "inactive" })}>비공개</button>}
            {community.recruitmentStatus === "recruiting"
              ? <button className="btn btn-ghost btn-small" onClick={() => void patch(community.id, { recruitmentStatus: "closed" })}>모집 마감</button>
              : <button className="btn btn-ghost btn-small" onClick={() => void patch(community.id, { recruitmentStatus: "recruiting" })}>모집 시작</button>}
            <button className="btn btn-ghost btn-small" onClick={() => void remove(community.id)}>운영 중지</button>
          </div>
          <div className="community-management-chat"><OpenChatManager communityId={community.id} /></div>
        </div>
      </article>)}
    </div> : <div className="empty"><Users size={40} /><h3>아직 운영 중인 커뮤니티가 없습니다.</h3><p className="muted">첫 커뮤니티를 만들고 지역의 취향을 연결해보세요.</p><Link className="btn btn-primary" href="/communities/register">첫 커뮤니티 만들기</Link></div>}
  </div></section>;
}
