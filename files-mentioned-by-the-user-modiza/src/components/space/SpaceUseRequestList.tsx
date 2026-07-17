"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Eye, MapPin, Users, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SpaceUseRequest, SpaceUseRequestContact, SpaceUseRequestStatus } from "@/types/space-use-request";

const labels: Record<SpaceUseRequestStatus, string> = {
  pending: "검토 중",
  negotiating: "협의 필요",
  approved: "승인",
  rejected: "거절",
  confirmed: "이용 확정",
  cancelled: "취소",
};
const contactLabels = {
  store_phone: "매장 전화번호",
  kakao_open_chat: "카카오톡 오픈채팅",
  kakao_channel: "카카오톡 채널",
  instagram: "인스타그램",
  other: "기타 연락 방법",
};
const useModeLabels = {
  idle_time_only: "비는 시간에만 이용 가능",
  during_operation: "운영 시간에도 이용 가능",
  request_consultation: "요청 후 협의",
};

function Contact({ contact }: { contact: SpaceUseRequestContact }) {
  const isLink = ["kakao_open_chat", "kakao_channel"].includes(contact.method) || /^https?:\/\//i.test(contact.value);
  const href = contact.method === "store_phone"
    ? `tel:${contact.value.replace(/[^0-9+]/g, "")}`
    : contact.method === "instagram"
      ? /^https?:\/\//i.test(contact.value) ? contact.value : `https://www.instagram.com/${contact.value.replace(/^@/, "")}`
      : isLink ? contact.value : "";
  return <aside className="approved-contact-card"><div><strong>협의 연락 방법</strong><span>{contactLabels[contact.method]}</span><b>{contact.value}</b></div>{href && <a className="btn btn-primary btn-small" href={href} target={contact.method === "store_phone" ? undefined : "_blank"} rel={contact.method === "store_phone" ? undefined : "noopener noreferrer"}>{contact.method === "store_phone" ? "전화하기" : "바로가기"}<ExternalLink size={15} /></a>}</aside>;
}

export function SpaceUseRequestList({ scope, initialStatus = "all" }: { scope: "owned" | "requested"; initialStatus?: SpaceUseRequestStatus | "all" }) {
  const [items, setItems] = useState<SpaceUseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState("");
  const [statusFilter, setStatusFilter] = useState<SpaceUseRequestStatus | "all">(initialStatus);
  const [spaceFilter, setSpaceFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/space-use-requests?scope=${scope}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setItems(result);
    else setError(result.message || "이용 요청을 불러오지 못했어요.");
    setLoading(false);
  }
  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      fetch(`/api/space-use-requests?scope=${scope}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "이용 요청을 불러오지 못했어요.");
          setItems(result);
          const requestId = new URLSearchParams(window.location.search).get("requestId");
          if (requestId) setExpanded(requestId);
        })
        .catch((caught) => {
          if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "이용 요청을 불러오지 못했어요.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    });
    return () => { cancelAnimationFrame(frame); controller.abort(); };
  }, [scope]);

  async function action(id: string, next: "negotiate" | "approve" | "reject" | "confirm" | "memo") {
    if (next === "negotiate" && !memos[id]?.trim()) return setError("협의할 내용을 메모로 작성해주세요.");
    if (next === "reject" && !memos[id]?.trim()) return setError("거절 사유 또는 조정 가능한 내용을 메모에 작성해 주세요.");
    setProcessing(id);
    setError("");
    const response = await fetch(`/api/space-use-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: next, ownerMemo: memos[id] }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.message || "요청을 처리하지 못했어요.");
    else setItems((current) => current.map((item) => item.id === id ? result : item));
    setProcessing("");
  }

  const spaces = useMemo(() => [...new Map(items.filter((item) => item.space).map((item) => [item.space!.id, item.space!])).values()], [items]);
  const visibleItems = items.filter((item) =>
    (statusFilter === "all" || item.status === statusFilter)
    && (spaceFilter === "all" || item.spaceId === spaceFilter)
  );

  if (loading) return <div className="panel">공간 이용 요청을 불러오는 중...</div>;
  if (!items.length) return <div className="empty"><CalendarDays size={40} /><h3>{scope === "owned" ? "들어온 공간 이용 요청이 없습니다." : "보낸 공간 이용 요청이 없습니다."}</h3><p className="muted">{scope === "owned" ? "새 요청이 들어오면 알림과 이 화면에서 확인할 수 있어요." : "공간 상세에서 운영 중인 커뮤니티의 이용 요청을 보낼 수 있어요."}</p></div>;

  return <div className="space-request-list">
    {error && <p className="error-summary" role="alert">{error}</p>}
    <div className="space-request-filters" aria-label="이용 요청 필터">
      <label>상태<select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SpaceUseRequestStatus | "all")}><option value="all">전체</option><option value="pending">검토 중</option><option value="negotiating">협의 필요</option><option value="approved">승인</option><option value="rejected">거절</option><option value="confirmed">예약 확정</option><option value="cancelled">취소</option></select></label>
      {scope === "owned" && spaces.length > 1 && <label>공간<select className="field" value={spaceFilter} onChange={(event) => setSpaceFilter(event.target.value)}><option value="all">공간 전체</option>{spaces.map((space) => <option value={space.id} key={space.id}>{space.name}</option>)}</select></label>}
    </div>
    {!visibleItems.length && <div className="empty compact">선택한 조건에 해당하는 이용 요청이 없습니다.</div>}
    {visibleItems.map((item) => <article className="panel space-request-card" id={`request-${item.id}`} key={item.id}>
      <div className="section-heading"><div><div className="meta"><span className={`tag request-status-${item.status}`}>{labels[item.status]}</span><span className="tag">{item.requestType === "inquiry" ? "이용 문의" : "이용 요청"}</span></div><h2>{scope === "owned" ? item.community?.name : item.space?.name}</h2>{scope === "owned" && item.space && <p className="muted">{item.space.name}{item.community?.hostNickname ? ` · 운영자 ${item.community.hostNickname}` : ""}</p>}</div><small className="muted">신청 {new Date(item.createdAt).toLocaleDateString("ko-KR")}</small></div>
      <div className="space-request-summary">
        <span><CalendarDays />{item.requestedDate}</span><span><Clock3 />{item.requestedStartTime}~{item.requestedEndTime}</span><span><Users />{item.expectedAttendees}명</span>
      </div>
      <button type="button" className="btn btn-ghost btn-small request-detail-toggle" onClick={() => setExpanded((current) => current === item.id ? null : item.id)}><Eye />{expanded === item.id ? "상세 닫기" : "상세보기"}</button>
      {expanded === item.id && <>
      {item.space && <p className="muted"><MapPin size={15} /> {[item.space.address, item.space.addressDetail].filter(Boolean).join(" ")}</p>}
      <div className="request-detail-grid">
        {item.space && <div><strong>공간 정보</strong><p>{useModeLabels[item.space.communityUseMode]}</p>{item.space.minimumOrderOrFee && <p>최소 주문 또는 이용료: {item.space.minimumOrderOrFee}</p>}{item.space.usageRules && <p>이용 규칙: {item.space.usageRules}</p>}</div>}
        {item.community && <div><strong>요청 커뮤니티</strong><p>{item.community.shortDescription}</p><p>{item.community.category} · 현재 {item.community.currentMembers}/{item.community.capacity}명</p></div>}
      </div>
      <div className="request-detail-grid"><div><strong>모임 목적</strong><p>{item.purpose}</p></div><div><strong>전달 메시지</strong><p>{item.message || "별도 전달 메시지가 없습니다."}</p></div></div>
      {item.ownerMemo && <aside className="owner-memo"><strong>공간 운영자 메시지</strong><p>{item.ownerMemo}</p>{item.memoUpdatedAt && <small className="muted">{new Date(item.memoUpdatedAt).toLocaleString("ko-KR")} 업데이트</small>}</aside>}
      {item.contact && <Contact contact={item.contact} />}
      {scope === "owned" && (item.status === "pending" || item.status === "negotiating") && <div className="request-response-form"><label>운영자 메모 <span className="muted">(선택, 협의 필요·승인·거절 시 커뮤니티 운영자에게 전달)</span><textarea className="field" rows={3} value={memos[item.id] ?? item.ownerMemo ?? ""} onChange={(event) => setMemos((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="예: 18시는 어렵고 19시부터 가능합니다." /></label><div className="management-actions"><button className="btn btn-ghost btn-small" disabled={processing === item.id} onClick={() => void action(item.id, "negotiate")}><Clock3 />협의 필요</button><button className="btn btn-primary btn-small" disabled={processing === item.id} onClick={() => void action(item.id, "approve")}><CheckCircle2 />승인</button><button className="btn btn-ghost btn-small" disabled={processing === item.id} onClick={() => void action(item.id, "reject")}><XCircle />거절</button></div></div>}
      {scope === "owned" && !["pending", "negotiating", "cancelled"].includes(item.status) && <div className="request-response-form"><label>운영자 메모 수정 <span className="muted">(선택)</span><textarea className="field" rows={3} value={memos[item.id] ?? item.ownerMemo ?? ""} onChange={(event) => setMemos((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button className="btn btn-ghost btn-small" disabled={processing === item.id} onClick={() => void action(item.id, "memo")}>메모 저장</button></div>}
      {item.status === "confirmed" && <div className="request-confirm-row"><p><strong>예약이 확정되었습니다.</strong><br />{item.requestedDate} {item.requestedStartTime}~{item.requestedEndTime}</p></div>}
      {scope === "requested" && item.status === "approved" && <div className="request-confirm-row"><p>기존 승인 요청입니다. 예약 확정을 완료해주세요.</p><button className="btn btn-primary btn-small" disabled={processing === item.id} onClick={() => void action(item.id, "confirm")}><CheckCircle2 />예약 확정</button></div>}
      <div className="management-actions">
        {item.community && <Link className="btn btn-ghost btn-small" href={`/communities/${item.community.slug}`}>커뮤니티 보기</Link>}
        {item.space && <Link className="btn btn-ghost btn-small" href={`/spaces/${item.space.slug}`}>공간 보기</Link>}
      </div>
      </>}
    </article>)}
  </div>;
}
