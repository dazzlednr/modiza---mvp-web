import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Repeat2, UserRound, Users } from "lucide-react";
import { ApplicationForm } from "@/components/community/ApplicationForm";
import { FavoriteButton } from "@/components/community/FavoriteButton";
import { MeetingPlaceCard } from "@/components/community/MeetingPlaceCard";
import { formatRegion } from "@/constants/taxonomy";
import { calculateRecruitmentStatus, recruitmentLabels } from "@/lib/community/recruitment";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { isFavorite } from "@/repositories/favoriteRepository";
import { getCommunityWithSpace } from "@/repositories/communityRepository";
import { getProfileByUserId } from "@/repositories/profileRepository";

export const dynamic = "force-dynamic";

const formatMeeting = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      dateStyle: "long",
      timeStyle: "short",
      hour12: true,
    }).format(new Date(value))
  : "일정 조율 중";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const rawSlug = (await params).slug;
  let slug = rawSlug;
  try { slug = decodeURIComponent(rawSlug); } catch { /* invalid slug */ }

  const db = await createAuthServerSupabaseClient();
  const [community, auth] = await Promise.all([getCommunityWithSpace(db, slug), db.auth.getUser()]);
  if (!community) notFound();

  const profile = auth.data.user ? await getProfileByUserId(db, auth.data.user.id).catch(() => null) : null;
  const favorite = auth.data.user ? await isFavorite(db, community.id).catch(() => false) : false;
  const applicant = auth.data.user ? {
    nickname: profile?.nickname ?? String(auth.data.user.user_metadata?.nickname ?? "회원"),
    email: profile?.email ?? auth.data.user.email ?? "",
  } : null;
  const displayStatus = calculateRecruitmentStatus(community);
  let disabledReason = "";
  if (displayStatus === "closed" || displayStatus === "completed") disabledReason = "현재 모집이 마감되었어요.";
  else if (displayStatus === "full") disabledReason = "모집 정원이 모두 찼어요.";

  const region = formatRegion(community.mainRegion, community.detailedRegion, community.customRegion);
  const category = community.category;
  const detailTags = [...new Set([...community.moodTags, ...community.tags])];
  const frequencyLabels = { one_time:"한 번 진행",weekly:"매주",biweekly:"격주",monthly:"매월",custom:"직접 설정" } as const;

  return (
    <section className="section community-detail">
      <div className="container community-detail-container">
        <div className="cover community-detail-cover">
          <Image src={community.thumbnailUrl || "/community-placeholder.svg"} alt={community.name} fill priority sizes="(max-width: 960px) 100vw, 1120px" />
          <FavoriteButton communityId={community.id} initialFavorite={favorite} authenticated={Boolean(auth.data.user)} returnTo={`/communities/${community.slug}`} />
        </div>

        <article className="community-detail-body">
          <header className="community-detail-header">
            <div className="community-detail-kicker"><span className="tag">{category}</span><span className="tag status">{recruitmentLabels[displayStatus]}</span></div>
            <h1>{community.name}</h1>
            <p>{community.shortDescription}</p>
          </header>

          <section className="community-schedule-card" aria-labelledby="community-schedule-title">
            <div className="community-schedule-icon"><CalendarDays aria-hidden="true" /></div>
            <div><span id="community-schedule-title">다음 모임</span><strong>{formatMeeting(community.nextMeetingAt)}</strong><p><MapPin size={15} aria-hidden="true" /> {region}</p></div>
            <div className="community-schedule-meta"><span><Users size={16} aria-hidden="true" /> {community.currentMembers}/{community.capacity}명</span><span>{community.participationFee ? `${community.participationFee.toLocaleString("ko-KR")}원` : "참가비 무료"}</span></div>
          </section>

          <section className="panel community-participation-summary">
            <div className="community-story-grid"><div><h3><Repeat2 size={18}/> 모임 방식</h3><p>{community.meetingFrequencyLabel || frequencyLabels[community.meetingFrequencyType]}</p></div><div><h3><Clock size={18}/> 예상 활동 시간</h3><p>약 {community.durationMinutes >= 60 ? `${Math.floor(community.durationMinutes/60)}시간${community.durationMinutes%60?` ${community.durationMinutes%60}분`:""}` : `${community.durationMinutes}분`}</p></div></div>
            {community.recommendedFor.length>0&&<div><h3>이런 분께 추천해요</h3><ul>{community.recommendedFor.map(item=><li key={item}>{item}</li>)}</ul></div>}
          </section>

          {community.activityImages&&community.activityImages.length>0&&<section className="community-story"><p className="eyebrow">Activity gallery</p><h2>함께한 순간들</h2><div className="community-activity-gallery">{community.activityImages.map((image,index)=><div className="community-activity-photo" key={image.id}><Image src={image.publicUrl} alt={`${community.name} 활동 사진 ${index+1}`} fill sizes="(max-width: 720px) 80vw, 360px"/></div>)}</div></section>}

          {community.hostProfile&&<section className="panel community-host-card"><div className="community-host-avatar">{community.hostProfile.profileImage?<Image src={community.hostProfile.profileImage} alt={community.hostProfile.nickname} fill/>:<UserRound/>}</div><div><p className="eyebrow">Community host</p><h2>{community.hostProfile.nickname}</h2><strong>{community.hostProfile.headline}</strong><p>{community.hostProfile.introduction}</p><div className="meta">{community.hostProfile.activityRegion&&<span className="tag">{community.hostProfile.activityRegion}</span>}{community.hostProfile.interestCategories.map(category=><span className="tag" key={category}>{category}</span>)}{community.hostProfile.operatingStyles.map(style=><span className="tag" key={style}>{style}</span>)}</div></div></section>}

          {community.otherHostCommunities&&community.otherHostCommunities.length>0&&<section className="community-story"><h2>이 운영자의 다른 커뮤니티</h2><div className="grid cards">{community.otherHostCommunities.map(item=><Link className="panel" href={`/communities/${item.slug}`} key={item.id}><strong>{item.name}</strong><p>{item.shortDescription}</p></Link>)}</div></section>}

          <section className="community-story" aria-labelledby="community-story-title">
            <p className="eyebrow">About community</p><h2 id="community-story-title">이런 모임이에요</h2>
            <p className="community-story-main">{community.description}</p>
            <div className="community-story-grid">
              {community.activityDescription && <div><h3>함께하는 활동</h3><p>{community.activityDescription}</p></div>}
              {community.targetAudience && <div><h3>이런 분과 함께해요</h3><p>{community.targetAudience}</p></div>}
              {community.preparationItems && <div><h3>준비물</h3><p>{community.preparationItems}</p></div>}
              {community.rules && <div><h3>함께 지키는 약속</h3><p>{community.rules}</p></div>}
            </div>
            {detailTags.length > 0 && <div className="meta community-detail-tags">{detailTags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>}
          </section>

          {community.linkedSpace
            ? <MeetingPlaceCard place={community.linkedSpace} />
            : <section className="meeting-place-card meeting-place-empty"><p className="eyebrow">Meeting place</p><h2><MapPin size={22} aria-hidden="true" /> 모임 장소</h2><p><strong>{region}</strong>에서 진행되며, 상세 장소는 참여 확정 후 안내해드려요.</p></section>}

          {community.participationNotices.length>0&&<section className="panel"><h2>참여 전 확인해 주세요</h2><ul>{community.participationNotices.map(item=><li key={item}>{item}</li>)}</ul></section>}

          <section className="community-application-card" aria-labelledby="community-application-title">
            <div><p className="eyebrow">Join us</p><h2 id="community-application-title">이 모임에 함께할까요?</h2><p>로그인 계정과 연결해 신청 내역과 결과를 안전하게 확인할 수 있어요.</p></div>
            <div className="community-application-action"><span className="tag status">{recruitmentLabels[displayStatus]}</span><ApplicationForm applicant={applicant} community={{ id: community.id, name: community.name, slug: community.slug, questions: community.applicationQuestions, canApply: !disabledReason, disabledReason, nextMeetingAt: community.nextMeetingAt }} /></div>
          </section>
        </article>
      </div>
    </section>
  );
}
