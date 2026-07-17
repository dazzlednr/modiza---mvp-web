"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, LoaderCircle, MessageCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { CommunityApplication } from "@/types/community";
import { MapViewButton } from "@/components/common/MapViewButton";

type Detail = CommunityApplication & { entryNickname: string; openChatUrl: string | null; meetingPlace: { name: string; address: string; addressDetail: string | null } | null };
const labels = { pending: "승인 대기", approved: "참가 확정", rejected: "참가 거절", cancelled: "신청 취소" } as const;

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/me/applications/${id}`, { cache: "no-store" }).then(async (response) => { if (response.status === 401) return router.replace(`/login?next=${encodeURIComponent(`/mypage/applications/${id}`)}`); const data = await response.json(); if (!response.ok) throw new Error(data.message); setItem(data); }).catch((caught) => setError(caught instanceof Error ? caught.message : "신청 내역을 불러오지 못했어요.")); }, [id, router]);
  if (error) return <section className="section"><div className="container empty"><XCircle /><h2>{error}</h2><Link href="/mypage/applications">내 신청으로 돌아가기</Link></div></section>;
  if (!item) return <section className="section"><div className="container empty"><LoaderCircle />신청 내역을 불러오는 중...</div></section>;
  return <section className="section"><div className="container" style={{ maxWidth: 760 }}><div className="panel application-detail"><span className={`tag application-${item.status}`}>{labels[item.status]}</span><h1>{item.communityName}</h1><p className="muted">신청일 {new Date(item.appliedAt).toLocaleDateString("ko-KR")}</p>
    {item.status === "approved" && <section className="approved-chat-card"><CheckCircle2 /><div><h2>참가가 확정되었어요 🎉</h2><p>운영자가 참가 신청을 승인했습니다.</p>{item.meetingPlace && <div className="approved-place-info"><strong>모임 장소: {item.meetingPlace.name}</strong><p>{[item.meetingPlace.address,item.meetingPlace.addressDetail].filter(Boolean).join(" ")}</p><MapViewButton address={[item.meetingPlace.address,item.meetingPlace.addressDetail].filter(Boolean).join(" ")} placeName={item.meetingPlace.name} /></div>}{item.openChatUrl ? <><p className="muted">원활한 참가자 확인을 위해 오픈채팅 프로필의 닉네임을 MODIZA에서 사용하는 닉네임과 동일하게 설정해주세요.</p><strong>입장 닉네임: {item.entryNickname}</strong><a className="btn btn-primary" href={item.openChatUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />오픈채팅방 입장하기</a></> : <div className="open-chat-waiting"><MessageCircle /><h3>오픈채팅방을 준비하고 있어요</h3><p>운영자가 오픈채팅방을 등록하면 알림으로 알려드릴게요.</p></div>}</div></section>}
    {item.status === "pending" && <div className="empty compact"><h2>운영자가 신청을 확인하고 있어요</h2><p>참가 결과가 정해지면 알림으로 알려드릴게요.</p></div>}
    {item.status === "rejected" && <div className="empty compact"><h2>커뮤니티 신청 결과</h2><p>이번 참가 신청은 승인되지 않았습니다.</p></div>}
    <div className="management-actions"><Link className="btn btn-ghost" href="/mypage/applications">내 신청 목록</Link>{item.communitySlug && <Link className="btn btn-ghost" href={`/communities/${item.communitySlug}`}>커뮤니티 보기</Link>}</div>
  </div></div></section>;
}
