"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Pencil, Plus } from "lucide-react";
import { MeetingCard } from "@/components/meeting/MeetingCard";
import { allowedMeetingStatusTransitions, meetingStatusLabels } from "@/lib/meeting/validation";
import type { Meeting, MeetingStatus } from "@/types/meeting";

type Filter = "all" | "upcoming" | "recruiting" | "completed";

export function MeetingManagement({ initialItems }: { initialItems: Meeting[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const filtered = useMemo(() => items.filter((item) => {
    if (filter === "recruiting") return item.status === "recruiting";
    if (filter === "completed") return item.status === "completed" || item.status === "cancelled";
    if (filter === "upcoming") return Boolean(item.eventDate && item.eventDate >= today && !["completed", "cancelled"].includes(item.status));
    return true;
  }), [filter, items, today]);

  async function status(id: string, next: MeetingStatus) {
    if (next === "cancelled" && !window.confirm("이 모임을 취소할까요? 취소 상태는 되돌릴 수 없습니다.")) return;
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/meetings/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "상태를 변경하지 못했어요.");
      setItems((current) => current.map((item) => item.id === id ? result : item));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "상태를 변경하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/meetings/${id}/duplicate`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "모임을 복제하지 못했어요.");
      setItems((current) => [result, ...current]);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "모임을 복제하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  return <>
    <div className="section-heading page-heading"><div><p className="eyebrow">Meeting operations</p><h1 className="section-title">내가 운영하는 모임</h1><p className="muted">독립 모임과 커뮤니티 연결 모임을 한곳에서 관리합니다.</p></div><Link className="btn btn-primary" href="/meetings/new"><Plus />새 모임 만들기</Link></div>
    <nav className="meeting-filter-tabs" aria-label="모임 필터">{([['all','전체'],['upcoming','예정된 모임'],['recruiting','모집 중'],['completed','종료·취소']] as const).map(([value,label]) => <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</nav>
    {error && <p className="error-summary" role="alert">{error}</p>}
    {filtered.length ? <div className="meeting-management-list">{filtered.map((meeting) => <div key={meeting.id} className="meeting-management-item">
      <MeetingCard meeting={meeting} management />
      <div className="meeting-management-actions">
        <Link className="btn btn-ghost btn-small" href={`/dashboard/meetings/${meeting.id}/edit`}><Pencil />수정</Link>
        {meeting.status !== "draft" && <Link className="btn btn-ghost btn-small" href={`/meetings/${meeting.slug}`}><ExternalLink />공개 화면</Link>}
        <button className="btn btn-ghost btn-small" type="button" disabled={busy === meeting.id} onClick={() => duplicate(meeting.id)}><Copy />복제</button>
        {allowedMeetingStatusTransitions[meeting.status].map((next) => <button key={next} className={`btn btn-small ${next === "cancelled" ? "btn-danger" : next === "recruiting" ? "btn-primary" : "btn-ghost"}`} type="button" disabled={busy === meeting.id} onClick={() => status(meeting.id, next)}>{next === "recruiting" && meeting.status === "closed" ? "모집 재개" : meetingStatusLabels[next]}</button>)}
      </div>
    </div>)}</div> : <div className="empty"><h2>조건에 맞는 모임이 없어요.</h2><p className="muted">독립 모임이나 커뮤니티에 연결된 모임을 만들어보세요.</p><Link className="btn btn-primary" href="/meetings/new"><Plus />첫 모임 만들기</Link></div>}
  </>;
}
