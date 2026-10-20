import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CalendarDays, Link2, MapPin, Users, WalletCards } from "lucide-react";
import { meetingStatusLabels } from "@/lib/meeting/validation";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicMeetingBySlug } from "@/repositories/meetingRepository";

export const dynamic = "force-dynamic";

const meetingFor = cache(async (slug: string) => {
  return getPublicMeetingBySlug(await createAuthServerSupabaseClient(), slug);
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const meeting = await meetingFor((await params).slug);
  if (!meeting) return { title: "모임을 찾을 수 없어요 | MODIZA" };
  return {
    title: `${meeting.title} | MODIZA`,
    description: meeting.shortDescription || meeting.description.slice(0, 150),
    robots: meeting.visibility === "link_only" ? { index: false, follow: false } : undefined,
  };
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const meeting = await meetingFor((await params).slug);
  if (!meeting) notFound();
  const date = meeting.eventDate ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "full" }).format(new Date(`${meeting.eventDate}T00:00:00+09:00`)) : "날짜 미정";
  return <section className="section meeting-detail"><div className="container meeting-detail-container">
    <div className="meeting-detail-hero" style={meeting.imageUrl ? { backgroundImage: `linear-gradient(rgba(20,24,38,.28),rgba(20,24,38,.72)),url(${meeting.imageUrl})` } : undefined}>
      <div><div className="meta"><span className={`tag meeting-status-${meeting.status}`}>{meetingStatusLabels[meeting.status]}</span>{meeting.visibility === "link_only" && <span className="tag"><Link2 />링크 전용</span>}<span className="tag">{meeting.communityName ?? "독립 모임"}</span></div><h1>{meeting.title}</h1><p>{meeting.shortDescription}</p></div>
    </div>
    <div className="meeting-detail-grid"><main>
      <section className="panel meeting-detail-story"><p className="eyebrow">About</p><h2>모임 소개</h2><p>{meeting.description || "운영자가 상세 소개를 준비하고 있어요."}</p></section>
      <section className="panel meeting-detail-story"><p className="eyebrow">Preparation</p><h2>준비물</h2><p>{meeting.preparationItems || "별도 준비물은 없습니다."}</p></section>
      {meeting.participantEligibility === "community_members" && <section className="panel meeting-members-note"><Users /><div><strong>연결된 모임 회원 대상 설정</strong><p>회원 자격 자동 검증은 후속 개발에서 연결될 예정입니다. 현재는 운영자가 신청 단계에서 확인해야 합니다.</p></div></section>}
    </main><aside className="panel meeting-detail-summary">
      <h2>모임 정보</h2>
      <div><CalendarDays /><span>일정</span><strong>{date}<br />{meeting.startTime ?? ""}{meeting.endTime ? `–${meeting.endTime}` : ""}</strong></div>
      <div><MapPin /><span>장소</span><strong>{meeting.locationIsUndecided ? "장소 미정" : meeting.location || "장소 미정"}</strong></div>
      <div><Users /><span>정원</span><strong>{meeting.capacity ? `${meeting.capacity}명` : "미정"}</strong></div>
      <div><WalletCards /><span>참가비</span><strong>{meeting.participationFee ? `${meeting.participationFee.toLocaleString("ko-KR")}원` : "무료"}</strong></div>
      <p className="meeting-application-placeholder">모임별 참가 신청 기능은 다음 개발 단계에서 연결됩니다.</p>
      <Link className="btn btn-ghost" href="/meetings">다른 모임 둘러보기</Link>
    </aside></div>
  </div></section>;
}
