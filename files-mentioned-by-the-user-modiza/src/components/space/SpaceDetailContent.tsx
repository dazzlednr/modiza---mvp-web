import type { ReactNode } from "react";
import { Clock3, MapPin, Sparkles, Users } from "lucide-react";
import { formatRegion } from "@/constants/taxonomy";
import type { PublicSpaceDetail } from "@/types/public-space";
import { SpacePhotoGallery } from "@/components/space/SpacePhotoGallery";
import { MapViewButton } from "@/components/common/MapViewButton";

const DAY_NAMES: Record<number, string> = { 0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" };
const modeLabels = {
  idle_time_only: "비는 시간에만 이용 가능",
  during_operation: "운영 시간에도 이용 가능",
  request_consultation: "요청 후 협의",
} as const;
const noiseLabels = { quiet: "조용한 활동에 적합", moderate: "일반적인 대화 가능", active: "활동적인 모임 가능" } as const;
const contactLabels = {
  store_phone: "매장 전화번호",
  kakao_open_chat: "카카오톡 오픈채팅",
  kakao_channel: "카카오톡 채널",
  instagram: "인스타그램",
  other: "기타",
} as const;
const yesNo = (value: boolean) => value ? "가능" : "불가";
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function formatDayGroup(days: number[]) {
  const positions = [...new Set(days)]
    .map((day) => WEEK_ORDER.indexOf(day as (typeof WEEK_ORDER)[number]))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b);
  const ranges: number[][] = [];
  positions.forEach((position) => {
    const current = ranges.at(-1);
    if (current && current.at(-1) === position - 1) current.push(position);
    else ranges.push([position]);
  });
  return ranges.map((range) => {
    const first = DAY_NAMES[WEEK_ORDER[range[0]]];
    const last = DAY_NAMES[WEEK_ORDER[range.at(-1)!]];
    return range.length === 1 ? `${first}요일` : `${first}~${last}`;
  }).join(", ");
}

function groupOperatingHours(hours: PublicSpaceDetail["operatingHours"]) {
  const groups = new Map<string, { days: number[]; hour: PublicSpaceDetail["operatingHours"][number] }>();
  [...hours]
    .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek as (typeof WEEK_ORDER)[number]) - WEEK_ORDER.indexOf(b.dayOfWeek as (typeof WEEK_ORDER)[number]))
    .forEach((hour) => {
      const key = hour.isOpen
        ? [hour.startTime, hour.endTime, hour.hasBreak, hour.breakStartTime, hour.breakEndTime].join("|")
        : "closed";
      const group = groups.get(key);
      if (group) group.days.push(hour.dayOfWeek);
      else groups.set(key, { days: [hour.dayOfWeek], hour });
    });
  return [...groups.values()];
}

function TagGroup({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <div className="space-detail-tag-group"><strong>{title}</strong>{values.length
    ? <div className="meeting-place-tags">{values.map((value) => <span key={value}>{value}</span>)}</div>
    : <p className="muted">{empty}</p>}</div>;
}

function OperatingHours({ space }: { space: PublicSpaceDetail }) {
  if (!space.operatingHours.length) return <p className="muted">운영 시간이 아직 등록되지 않았습니다. 이용 전 운영자와 협의해 주세요.</p>;
  const groups = groupOperatingHours(space.operatingHours);
  const openGroups = groups.filter((group) => group.hour.isOpen);
  const closedGroup = groups.find((group) => !group.hour.isOpen);
  return <div className="detail-hours-list">
    {openGroups.map(({ days, hour }) => <div key={`${days.join("-")}-${hour.startTime}-${hour.endTime}`} className="detail-hour-row">
      <strong>{formatDayGroup(days)}</strong>
      <div className="detail-hour-value">
        <span>{hour.startTime}~{hour.endTime}</span>
        {hour.hasBreak && <small>브레이크 타임 {hour.breakStartTime}~{hour.breakEndTime}</small>}
      </div>
    </div>)}
    {closedGroup && <div className="detail-hour-row detail-hour-closed">
      <strong>휴무</strong>
      <span className="muted">{formatDayGroup(closedGroup.days)}</span>
    </div>}
  </div>;
}

function CommunityAvailability({ space }: { space: PublicSpaceDetail }) {
  if (space.communityUseMode === "request_consultation") return <p className="muted">운영자와 일정을 협의한 뒤 이용할 수 있습니다.</p>;
  if (!space.communityAvailability.length) return <p className="muted">커뮤니티 이용 가능 시간이 아직 등록되지 않았습니다.</p>;
  return <div className="detail-hours-list">{[...space.communityAvailability].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((item) => <div key={item.dayOfWeek} className="detail-hour-row"><strong>{DAY_NAMES[item.dayOfWeek]}요일</strong><span>{item.startTime}~{item.endTime}</span></div>)}</div>;
}

export function SpaceDetailContent({ space, actions }: { space: PublicSpaceDetail; actions?: ReactNode }) {
  const address = [space.address, space.addressDetail].filter(Boolean).join(" ");
  const region = formatRegion(space.mainRegion, space.detailedRegion, space.customRegion);

  return <article className="space-detail-content">
    <SpacePhotoGallery space={space} />
    <header className="space-detail-header">
      <div className="meta"><span className="tag">{space.spaceType}</span><span><MapPin size={15} /> {region}</span></div>
      <h1>{space.name}</h1>
      <p className="space-detail-lead">{space.shortDescription || "모임의 성격에 맞게 사용할 수 있는 장소입니다."}</p>
      <p className="muted">{address}</p>
    </header>

    {space.description && <section className="space-detail-section"><h2>장소 소개</h2><p className="space-detail-description">{space.description}</p></section>}

    <section className="space-detail-section space-analysis-card">
      <div className="space-analysis-title"><Sparkles size={21} aria-hidden="true" /><div><h2>모디자가 분석했어요</h2><p>등록한 정보와 사진 분석 결과를 바탕으로 정리했어요.</p></div></div>
      <div className="space-detail-tag-grid">
        <TagGroup title="추천 모임" values={space.suitableActivities} empty="추천 활동이 아직 등록되지 않았어요." />
        <TagGroup title="분위기" values={space.moods} empty="분위기 정보가 아직 등록되지 않았어요." />
        <TagGroup title="시설" values={space.facilities} empty="시설 정보가 아직 등록되지 않았어요." />
      </div>
      <p className="space-analysis-note">분석 결과는 참고용이며 실제 이용 조건은 운영자가 직접 확인한 정보를 기준으로 합니다.</p>
    </section>

    <section className="space-detail-section">
      <h2>운영 시간</h2>
      <OperatingHours space={space} />
    </section>

    <section className="space-detail-section">
      <h2>커뮤니티 이용 안내</h2>
      <p className="usage-mode-label">{modeLabels[space.communityUseMode]}</p>
      <CommunityAvailability space={space} />
      {space.communityRecurrenceType === "date_range" && <p className="muted">적용 기간: {space.communityAvailabilityStartDate || "미정"} ~ {space.communityAvailabilityEndDate || "미정"}</p>}
      {space.communityRecurrenceType === "specific_dates" && space.communitySpecificDates.length > 0 && <p className="muted">이용 가능 날짜: {space.communitySpecificDates.join(", ")}</p>}
      {space.minimumOrderOrFee && <p><strong>최소 주문 또는 이용료</strong> {space.minimumOrderOrFee}</p>}
      {space.additionalUseConditions && <p><strong>추가 이용 조건</strong> {space.additionalUseConditions}</p>}
    </section>

    <section className="space-detail-section">
      <h2>이용 정보</h2>
      <div className="space-usage-grid">
        <div><Users /><span>최소 인원</span><strong>{space.minCapacity}명</strong></div>
        <div><Users /><span>권장 인원</span><strong>{space.suitableCapacity ? `${space.suitableCapacity}명` : "운영자와 협의"}</strong></div>
        <div><Users /><span>최대 인원</span><strong>{space.maxCapacity}명</strong></div>
        <div><Clock3 /><span>최소 이용 시간</span><strong>{space.minimumHours}시간</strong></div>
        <div><span>시간당 예산</span><strong>{space.pricePerHour.toLocaleString("ko-KR")}원</strong></div>
        {space.preferredContactMethod && space.privateContact && <div className="space-negotiation-contact">
          <span>협의 연락 방법</span>
          <strong>{contactLabels[space.preferredContactMethod]}</strong>
          <p>{space.privateContact}</p>
        </div>}
      </div>
    </section>

    <section className="space-detail-section">
      <h2>이용 규칙</h2>
      {space.usageRules ? <p className="space-detail-description">{space.usageRules}</p> : <p className="muted">세부 이용 규칙은 요청 전에 운영자와 확인해 주세요.</p>}
      <ul className="space-rule-list">
        <li>외부 음식 <strong>{yesNo(space.foodAllowed)}</strong></li>
        <li>음주 <strong>{yesNo(space.alcoholAllowed)}</strong></li>
        <li>가구 이동 <strong>{yesNo(space.furnitureMovable)}</strong></li>
        <li>주차 <strong>{yesNo(space.parkingAvailable)}</strong></li>
        <li>소음 안내 <strong>{noiseLabels[space.noiseLevel]}</strong></li>
      </ul>
      {space.difficultActivities.length > 0 && <TagGroup title="이용이 어려운 활동" values={space.difficultActivities} empty="" />}
    </section>

    <section className="space-detail-section">
      <h2>위치</h2><p>{address || "상세 주소는 운영자에게 확인해 주세요."}</p>
      <MapViewButton address={address} placeName={space.name} label="네이버 지도에서 보기" />
    </section>

    <section className="space-detail-section space-review-placeholder"><h2>후기</h2><p>후기 기능은 베타 이후 추가 예정입니다.</p></section>
    {actions && <footer className="space-detail-actions">{actions}</footer>}
  </article>;
}
