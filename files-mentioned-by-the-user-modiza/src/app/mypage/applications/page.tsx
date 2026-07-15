"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import type { CommunityApplication } from "@/types/community";

const labels = { pending: "검토중", approved: "승인", rejected: "거절", cancelled: "취소" } as const;
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function Page() {
  const [items, setItems] = useState<CommunityApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function reload() { const response = await fetch("/api/me/applications", { cache: "no-store" }); if (!response.ok) throw new Error(); setItems(await response.json()); }
  useEffect(() => { const controller = new AbortController(); fetch("/api/me/applications", { cache: "no-store", signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<CommunityApplication[]>; }).then(setItems).catch((loadError: unknown) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError("내 신청을 불러오지 못했어요."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, []);
  async function cancel(id: string) { if (!confirm("이 신청을 취소할까요?")) return; const response = await fetch(`/api/me/applications/${id}`, { method: "PATCH" }); if (!response.ok) return setError((await response.json()).message); await reload(); }
  if (loading) return <section className="section"><div className="container">신청 내역을 불러오는 중...</div></section>;
  return <section className="section dashboard-shell"><div className="container" style={{ maxWidth: 960 }}><p className="eyebrow">My applications</p><h1 className="section-title">내 신청</h1><p className="muted">신청 상태와 다음 모임 일정을 확인할 수 있어요.</p>{error && <p className="error-summary">{error}</p>}
    {items.length ? <div className="management-list">{items.map((item) => <article className="panel application-card" key={item.id}><div className="section-heading"><div><span className={`tag application-${item.status}`}>{labels[item.status]}</span><h2>{item.communityName}</h2></div><ClipboardCheck /></div><div className="management-metrics"><span>신청일 <b>{new Date(item.appliedAt).toLocaleDateString("ko-KR")}</b></span><span><CalendarDays />다음 모임 <b>{item.nextMeetingAt ? date(item.nextMeetingAt) : "미정"}</b></span></div><div className="management-actions">{item.communitySlug && <Link className="btn btn-ghost btn-small" href={`/communities/${item.communitySlug}`}>상세보기</Link>}{item.status === "pending" && <button className="btn btn-ghost btn-small" onClick={() => void cancel(item.id)}>신청 취소</button>}</div></article>)}</div> : <div className="empty"><ClipboardCheck size={40} /><h3>신청한 모임이 없습니다.</h3><p className="muted">새로운 취향과 사람을 만날 커뮤니티를 찾아보세요.</p><Link className="btn btn-primary" href="/communities">커뮤니티 둘러보기</Link></div>}
  </div></section>;
}
