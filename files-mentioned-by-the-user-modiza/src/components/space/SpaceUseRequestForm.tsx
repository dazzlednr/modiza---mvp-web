"use client";

import Link from "next/link";
import { CalendarDays, Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { Community } from "@/types/community";

export function SpaceUseRequestForm({ spaceId, maxCapacity, initialCommunityId = "", isConsultation = false }: { spaceId: string; maxCapacity: number; initialCommunityId?: string; isConsultation?: boolean }) {
  const [open, setOpen] = useState(Boolean(initialCommunityId));
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const todayInKorea = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

  useEffect(() => {
    if (!initialCommunityId) return;
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      setLoadingContext(true);
      fetch("/api/space-use-requests?scope=context", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "커뮤니티 목록을 불러오지 못했어요.");
          setCommunities(result.communities ?? []);
        })
        .catch((caught) => {
          if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "커뮤니티 목록을 불러오지 못했어요.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingContext(false);
        });
    });
    return () => {
      cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [initialCommunityId]);

  async function showForm() {
    setOpen(true);
    if (communities.length || loadingContext) return;
    setLoadingContext(true);
    try {
      const response = await fetch("/api/space-use-requests?scope=context", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "커뮤니티 목록을 불러오지 못했어요.");
      setCommunities(result.communities ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "커뮤니티 목록을 불러오지 못했어요.");
    } finally {
      setLoadingContext(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/space-use-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId,
        communityId: String(form.get("communityId")),
        purpose: String(form.get("purpose")),
        requestedDate: String(form.get("requestedDate")),
        requestedStartTime: String(form.get("requestedStartTime")),
        requestedEndTime: String(form.get("requestedEndTime")),
        expectedAttendees: Number(form.get("expectedAttendees")),
        message: String(form.get("message") ?? ""),
        idempotencyKey: key,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "이용 요청을 보내지 못했어요.");
      setSaving(false);
      return;
    }
    setCompleted(true);
    setKey(crypto.randomUUID());
    setSaving(false);
  }

  if (completed) return <section className="space-request-callout success">
    <div><strong>공간 이용 요청을 보냈어요.</strong><p>공간 운영자가 확인한 뒤 사이트 내 알림으로 결과를 안내해드릴게요.</p></div>
    <Link className="btn btn-ghost btn-small" href="/dashboard/communities/space-requests">요청 내역 보기</Link>
  </section>;

  return <section className="space-request-callout">
    <div><strong>이 공간을 커뮤니티 모임에 이용하고 싶으신가요?</strong><p>희망 일정과 인원을 보내면 공간 운영자가 확인합니다. 필요한 경우 공간에 등록된 연락 수단으로 일정과 이용 조건을 협의할 수 있어요.</p></div>
    {!open
      ? <button type="button" className="btn btn-primary" onClick={() => void showForm()}><Send />{isConsultation ? "이 공간에 협의 요청" : "이용 요청"}</button>
      : <form className="form space-request-form" onSubmit={submit}>
        {loadingContext ? <p className="muted">내 커뮤니티를 불러오는 중...</p> : communities.length ? <>
          <div className="grid form-grid">
            <label>사용할 커뮤니티<select className="field" name="communityId" required defaultValue={communities.some((community) => community.id === initialCommunityId) ? initialCommunityId : ""}><option value="" disabled>선택해 주세요</option>{communities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label>
            <label>예상 인원<input className="field" type="number" name="expectedAttendees" min={1} max={maxCapacity} required /></label>
            <label>희망 날짜<input className="field" type="date" name="requestedDate" min={todayInKorea} required /></label>
            <div className="grid request-time-grid"><label>시작 시간<input className="field" type="time" name="requestedStartTime" required /></label><label>종료 시간<input className="field" type="time" name="requestedEndTime" required /></label></div>
          </div>
          <label>모임 목적<textarea className="field" name="purpose" rows={3} maxLength={500} required placeholder="예: 독서모임 참가자들과 책에 대해 대화하는 정기 모임입니다." /></label>
          <label>전달 메시지 <span className="muted">(선택)</span><textarea className="field" name="message" rows={4} maxLength={1000} placeholder={"안녕하세요.\n7월 24일 독서모임을 진행하고 싶습니다.\n가능 여부 확인 부탁드립니다."} /></label>
          {error && <p className="error-summary" role="alert">{error}</p>}
          <div className="assistant-actions"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>닫기</button><button className="btn btn-primary" disabled={saving}>{saving ? "요청을 보내는 중..." : <><CalendarDays />이용 요청 보내기</>}</button></div>
        </> : <div className="empty compact"><p>운영 중인 커뮤니티가 없습니다.</p><Link className="btn btn-primary btn-small" href="/communities/register">커뮤니티 만들기</Link></div>}
        {error && !communities.length && <p className="error-summary" role="alert">{error}</p>}
      </form>}
  </section>;
}
