"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicationStatus, CommunityApplication } from "@/types/community";

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "승인 대기",
  approved: "참가 확정",
  rejected: "참가 거절",
  cancelled: "신청 취소",
};

export default function Page() {
  const [apps, setApps] = useState<CommunityApplication[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [community, setCommunity] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/applications", { cache: "no-store" });
    if (response.ok) {
      const next = await response.json() as CommunityApplication[];
      setApps(next);
      const requestedCommunity = new URLSearchParams(window.location.search).get("communityId");
      const requested = next.find((item) => item.communityId === requestedCommunity);
      if (requested) setCommunity(requested.communityName);
      const requestedStatus = new URLSearchParams(window.location.search).get("status");
      if (requestedStatus && ["pending", "approved", "rejected", "cancelled"].includes(requestedStatus)) setStatus(requestedStatus);
    } else setError("신청 목록을 불러오지 못했어요.");
    setLoading(false);
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, []);

  const communities = useMemo(() => [...new Set(apps.map((item) => item.communityName))], [apps]);
  const list = apps.filter((item) =>
    (status === "all" || item.status === status) &&
    (community === "all" || item.communityName === community) &&
    `${item.applicantName} ${item.applicantContact}`.includes(query.trim()),
  );
  const current = apps.find((item) => item.id === selected);

  async function update(id: string, next: ApplicationStatus, memo?: string | null) {
    setError("");
    const response = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, operatorMemo: memo }),
    });
    if (!response.ok) throw new Error((await response.json()).message);
    await load();
    setSelected(null);
  }

  if (loading) return <section className="section"><div className="container">신청자를 불러오는 중...</div></section>;
  return <section className="section"><div className="container">
    <p className="eyebrow">Applications</p><h1 className="section-title">참여 신청 관리</h1>
    {error && <p className="error-summary">{error}</p>}
    <div className="filters" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
      <input className="field" placeholder="이름 또는 연락처 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className="field" value={community} onChange={(event) => setCommunity(event.target.value)}><option value="all">모든 커뮤니티</option>{communities.map((name) => <option key={name}>{name}</option>)}</select>
      <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">모든 상태</option><option value="pending">승인 대기</option><option value="approved">참가 확정</option><option value="rejected">참가 거절</option><option value="cancelled">신청 취소</option></select>
    </div>
    {list.length ? <div className="grid">{list.map((item) => <button type="button" className="panel" style={{ textAlign: "left" }} key={item.id} onClick={() => setSelected(item.id)}>
      <div className="meta" style={{ justifyContent: "space-between" }}><b>{item.applicantName} · {item.communityName}</b><span className={`tag application-${item.status}`}>{statusLabels[item.status]}</span></div>
      <p>{item.motivation}</p><small className="muted">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(item.appliedAt))}</small>
    </button>)}</div> : <div className="empty"><h3>신청자가 없어요</h3></div>}
    {current && <ApplicationDialog app={current} close={() => setSelected(null)} update={update} onError={setError} />}
  </div></section>;
}

function ApplicationDialog({ app, close, update, onError }: {
  app: CommunityApplication;
  close: () => void;
  update: (id: string, status: ApplicationStatus, memo?: string | null) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [memo, setMemo] = useState(app.operatorMemo ?? "");
  const [busy, setBusy] = useState<ApplicationStatus | null>(null);
  async function decide(next: ApplicationStatus) {
    if (busy || app.status === next) return;
    setBusy(next);
    try { await update(app.id, next, memo); }
    catch (error) { onError(error instanceof Error ? error.message : "신청 상태를 변경하지 못했어요."); setBusy(null); }
  }
  return <div className="dialog-backdrop"><div className="dialog" style={{ maxHeight: "90vh", overflow: "auto" }}>
    <h2>{app.applicantName}님의 신청</h2>
    <p><b>커뮤니티</b><br />{app.communityName}</p><p><b>연락처</b><br />{app.applicantContact}</p><p><b>자기소개</b><br />{app.introduction}</p><p><b>참여 동기</b><br />{app.motivation}</p>
    {Object.entries(app.answers).map(([question, answer]) => <p key={question}><b>{question}</b><br />{answer || "답변 없음"}</p>)}
    <label>운영자 메모<textarea className="field" rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
    <div className="management-actions" style={{ marginTop: 16 }}>
      <button type="button" className="btn btn-primary" disabled={Boolean(busy) || app.status === "approved"} onClick={() => void decide("approved")}>{busy === "approved" ? "처리 중..." : app.status === "approved" ? "참가 확정됨" : "참가 확정"}</button>
      <button type="button" className="btn btn-ghost" disabled={Boolean(busy) || app.status === "rejected"} onClick={() => void decide("rejected")}>{busy === "rejected" ? "처리 중..." : app.status === "rejected" ? "참가 거절됨" : "참가 거절"}</button>
    </div>
    <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} disabled={Boolean(busy)} onClick={close}>닫기</button>
  </div></div>;
}
