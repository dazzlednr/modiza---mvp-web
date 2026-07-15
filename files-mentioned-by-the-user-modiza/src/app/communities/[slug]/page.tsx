import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { ApplicationForm } from "@/components/community/ApplicationForm";
import { DetailItem } from "@/components/common/DetailItem";
import { formatRegion } from "@/constants/taxonomy";
import { calculateRecruitmentStatus, recruitmentLabels } from "@/lib/community/recruitment";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getCommunityWithSpace } from "@/repositories/communityRepository";
import { getProfileByUserId } from "@/repositories/profileRepository";

export const dynamic = "force-dynamic";
const format = (value?: string | null) => value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" }).format(new Date(value)) : "일정 준비 중";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const rawSlug = (await params).slug; let slug = rawSlug; try { slug = decodeURIComponent(rawSlug); } catch { /* invalid slug */ }
  const db = await createAuthServerSupabaseClient();
  const [community, auth] = await Promise.all([getCommunityWithSpace(db, slug), db.auth.getUser()]);
  if (!community) notFound();
  const profile = auth.data.user ? await getProfileByUserId(db, auth.data.user.id).catch(() => null) : null;
  const applicant = auth.data.user ? { nickname: profile?.nickname ?? String(auth.data.user.user_metadata?.nickname ?? "회원"), email: profile?.email ?? auth.data.user.email ?? "" } : null;
  const displayStatus = calculateRecruitmentStatus(community);
  let disabledReason = "";
  if (displayStatus === "closed" || displayStatus === "completed") disabledReason = "현재 모집이 마감되었어요.";
  else if (displayStatus === "full") disabledReason = "모집 정원이 모두 찼어요.";

  return <section className="section"><div className="container">
    <div className="cover" style={{ aspectRatio: "16/7", borderRadius: 28 }}><Image src={community.thumbnailUrl || "/community-placeholder.svg"} alt={community.name} fill priority /></div>
    <div className="detail-grid" style={{ marginTop: 34 }}><article><span className="tag">{community.category === "기타" ? community.customCategory || "기타" : community.category}</span><h1 className="section-title">{community.name}</h1><p style={{ fontSize: 20 }}>{community.shortDescription}</p>
      <div className="detail-info-grid"><DetailItem label="참여 대상" value={community.targetAudience} /><DetailItem label="모임 일시" value={format(community.nextMeetingAt)} /><DetailItem label="모집 인원" value={`${community.currentMembers}/${community.capacity}명`} /><DetailItem label="지역" value={formatRegion(community.mainRegion, community.detailedRegion, community.customRegion)} /><DetailItem label="카테고리" value={community.category === "기타" ? community.customCategory : community.category} /><DetailItem label="참가 비용" value={community.participationFee ? `${community.participationFee.toLocaleString("ko-KR")}원` : "무료"} /><DetailItem label="공간" value={community.linkedSpace?.name ?? "공간 미연결"} /><DetailItem label="모집 상태" value={recruitmentLabels[displayStatus]} /></div>
      <hr style={{ margin: "36px 0", borderColor: "var(--border)" }} /><h2>모임 소개</h2><p className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{community.description}</p>
      {community.activityDescription && <><h2>활동 내용</h2><p style={{ whiteSpace: "pre-wrap" }}>{community.activityDescription}</p></>}{community.rules && <><h2>운영 규칙</h2><p style={{ whiteSpace: "pre-wrap" }}>{community.rules}</p></>}{community.preparationItems && <><h2>준비물</h2><p>{community.preparationItems}</p></>}
      <div className="meta">{[...community.moodTags, ...community.tags].map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>
      {community.linkedSpace && <section className="panel" style={{ marginTop: 36 }}><p className="eyebrow">Meeting space</p><h2>{community.linkedSpace.name}</h2><p><MapPin size={15} /> {community.linkedSpace.address}</p><p>시간당 {community.linkedSpace.pricePerHour.toLocaleString("ko-KR")}원 · 최대 {community.linkedSpace.maxCapacity}명</p><Link className="btn btn-ghost" href={`/spaces/${community.linkedSpace.slug}`}>공간 자세히 보기</Link></section>}
    </article><aside className="panel sidebar"><span className="tag status">{recruitmentLabels[displayStatus]}</span><h3>함께하고 싶으신가요?</h3><p className="muted">로그인 계정과 연결해 안전하게 신청 내역을 관리해요.</p><ApplicationForm applicant={applicant} community={{ id: community.id, name: community.name, slug: community.slug, questions: community.applicationQuestions, canApply: !disabledReason, disabledReason, nextMeetingAt: community.nextMeetingAt }} /></aside></div>
  </div></section>;
}
