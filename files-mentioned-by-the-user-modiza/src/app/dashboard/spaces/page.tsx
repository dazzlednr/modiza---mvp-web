"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Building2, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { Space, SpaceStatus } from "@/types/space";

export default function Page() {
  const [items, setItems] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() { try { const response = await fetch("/api/spaces", { cache: "no-store" }); if (!response.ok) throw new Error(); setItems(await response.json()); } catch { setError("공간 목록을 불러오지 못했어요."); } finally { setLoading(false); } }
  useEffect(() => { const controller = new AbortController(); fetch("/api/spaces", { cache: "no-store", signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Space[]>; }).then(setItems).catch((loadError: unknown) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError("공간 목록을 불러오지 못했어요."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, []);
  async function status(id: string, next: SpaceStatus) { const response = await fetch(`/api/spaces/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }); if (!response.ok) return setError((await response.json()).message); await load(); }
  async function remove(id: string) { if (!confirm("공간과 등록 이미지를 완전히 삭제할까요?")) return; const response = await fetch(`/api/spaces/${id}`, { method: "DELETE" }); if (!response.ok) return setError((await response.json()).message); await load(); }
  if (loading) return <section className="section"><div className="container">내 공간을 불러오는 중...</div></section>;
  return <section className="section dashboard-shell"><div className="container"><div className="section-heading page-heading"><div><p className="eyebrow">My spaces</p><h1 className="section-title">내 공간</h1><p className="muted">공개 상태와 AI 분석 현황을 한눈에 관리하세요.</p></div><Link className="btn btn-primary" href="/spaces/register">새 공간 등록</Link></div>{error && <p className="error-summary">{error}</p>}
    {items.length ? <div className="management-list">{items.map((space) => <article className="management-card" key={space.id}><div className="management-thumb">{space.thumbnailUrl ? <Image src={space.thumbnailUrl} fill alt={space.name} /> : <div className="empty compact">이미지 없음</div>}</div><div className="management-content"><div className="section-heading"><div><div className="meta"><span className="tag">{space.status === "active" ? "공개중" : space.status === "draft" ? "임시 저장" : "비공개"}</span><span className={`tag ${space.analysisUpdatedAt ? "analysis-done" : "analysis-needed"}`}>{space.analysisUpdatedAt ? "AI 분석 완료" : "AI 분석 필요"}</span></div><h2>{space.name}</h2></div><small className="muted">최근 수정 {new Date(space.updatedAt).toLocaleDateString("ko-KR")}</small></div><p>{space.mainRegion} · 시간당 {space.pricePerHour.toLocaleString("ko-KR")}원 · 최대 {space.maxCapacity}명</p><div className="management-actions"><Link className="btn btn-ghost btn-small" href={`/dashboard/spaces/${space.id}/edit`}><Pencil />수정</Link><Link className="btn btn-ghost btn-small" href={`/dashboard/spaces/${space.id}/edit`}><Bot />{space.analysisUpdatedAt ? "AI 재분석" : "AI 분석"}</Link><button className="btn btn-ghost btn-small" onClick={() => void status(space.id, space.status === "active" ? "inactive" : "active")}>{space.status === "active" ? <><EyeOff />비공개</> : <><Eye />공개</>}</button><button className="btn btn-ghost btn-small" onClick={() => void remove(space.id)}><Trash2 />삭제</button></div></div></article>)}</div> : <div className="empty"><Building2 size={40} /><h3>등록한 공간이 없습니다.</h3><p className="muted">남는 공간을 새로운 커뮤니티와 연결해보세요.</p><Link className="btn btn-primary" href="/spaces/register">공간 등록하기</Link></div>}
  </div></section>;
}
