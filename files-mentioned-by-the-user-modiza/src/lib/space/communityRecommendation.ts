import type { Space, SpaceCommunityAvailability, SpaceOperatingHour } from "@/types/space";
import { toPublicSpaceDetail, type PublicSpaceDetail } from "@/types/public-space";

export type RecommendationAvailabilityStatus = "available" | "adjustment_required" | "consultation_required";
export type CommunitySpaceRecommendationInput = {
  category: string;
  activityDescription: string;
  moods: string[];
  capacity: number;
  facilities: string[];
  foodDrinkNeeded: boolean;
  detailedRegion: string;
  customRegion?: string;
  budgetMax: number;
  expectedDurationHours: number;
  meetingStartAt: string;
  meetingEndAt?: string;
  meetingFrequencyType?: string;
};
export type CommunitySpaceRecommendation = {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl?: string | null;
  location: string;
  pricePerHour: number;
  totalPrice: number;
  maxCapacity: number;
  facilities: string[];
  score: number;
  fitLabel: "조건이 잘 맞아요" | "대부분의 조건이 맞아요" | "일부 조건 조정이 필요해요";
  availabilityStatus: RecommendationAvailabilityStatus;
  availabilityLabel: "바로 이용 가능" | "시간 조정 필요" | "운영자 협의 필요";
  availabilitySummary: string;
  reasons: string[];
  matches: string[];
  details: PublicSpaceDetail;
};

const normalize = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/[\s·_-]+/g, "");
const includes = (values: string[], target: string) => values.some((value) => normalize(value).includes(normalize(target)) || normalize(target).includes(normalize(value)));
const minutes = (value?: string | null) => {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};
const endAfter = (start: number, end: number) => end <= start ? end + 1440 : end;

function meetingParts(input: CommunitySpaceRecommendationInput) {
  const [date, clock = "00:00"] = input.meetingStartAt.split("T");
  const start = minutes(clock) ?? 0;
  let end = start + input.expectedDurationHours * 60;
  if (input.meetingEndAt && !input.meetingEndAt.endsWith("Z")) {
    const requestedEnd = minutes(input.meetingEndAt.split("T")[1]?.slice(0, 5));
    if (requestedEnd !== null) end = endAfter(start, requestedEnd);
  }
  return { date, dayOfWeek: new Date(`${date}T00:00:00+09:00`).getDay(), start, end };
}

function contains(startTime: string | null | undefined, endTime: string | null | undefined, meetingStart: number, meetingEnd: number) {
  const start = minutes(startTime);
  const rawEnd = minutes(endTime);
  if (start === null || rawEnd === null) return false;
  const end = endAfter(start, rawEnd);
  let requestedStart = meetingStart;
  let requestedEnd = meetingEnd;
  if (requestedStart < start && end > 1440) {
    requestedStart += 1440;
    requestedEnd += 1440;
  }
  return requestedStart >= start && requestedEnd <= end;
}

function overlapsBreak(hour: SpaceOperatingHour, meetingStart: number, meetingEnd: number) {
  if (!hour.hasBreak) return false;
  const open = minutes(hour.startTime);
  const breakStartRaw = minutes(hour.breakStartTime);
  const breakEndRaw = minutes(hour.breakEndTime);
  if (open === null || breakStartRaw === null || breakEndRaw === null) return false;
  let breakStart = breakStartRaw;
  let breakEnd = endAfter(breakStart, breakEndRaw);
  if (breakStart < open) { breakStart += 1440; breakEnd += 1440; }
  let requestedStart = meetingStart;
  let requestedEnd = meetingEnd;
  if (requestedStart < open && breakStart >= 1440) { requestedStart += 1440; requestedEnd += 1440; }
  return requestedStart < breakEnd && requestedEnd > breakStart;
}

function dateAllowed(space: Space, date: string) {
  if (space.communityRecurrenceType === "date_range") {
    return (!space.communityAvailabilityStartDate || date >= space.communityAvailabilityStartDate)
      && (!space.communityAvailabilityEndDate || date <= space.communityAvailabilityEndDate);
  }
  if (space.communityRecurrenceType === "specific_dates") return space.communitySpecificDates.includes(date);
  return true;
}

function timeStatus(space: Space, input: CommunitySpaceRecommendationInput) {
  if (space.communityUseMode === "request_consultation") {
    return {
      status: "consultation_required" as const,
      label: "운영자 협의 필요" as const,
      summary: "이 공간은 요청을 받은 뒤 운영자가 이용 가능 여부와 일정을 확인합니다.",
    };
  }
  const meeting = meetingParts(input);
  const availability = space.communityAvailability.find((item: SpaceCommunityAvailability) => item.dayOfWeek === meeting.dayOfWeek);
  const availabilityMatches = Boolean(availability)
    && dateAllowed(space, meeting.date)
    && contains(availability?.startTime, availability?.endTime, meeting.start, meeting.end);

  if (space.communityUseMode === "idle_time_only") {
    return availabilityMatches
      ? { status: "available" as const, label: "바로 이용 가능" as const, summary: "선택한 일정이 등록된 커뮤니티 이용 가능 시간에 포함됩니다." }
      : { status: "adjustment_required" as const, label: "시간 조정 필요" as const, summary: availability ? `이 공간의 커뮤니티 이용 가능 시간은 ${availability.startTime}~${availability.endTime}입니다.` : "선택한 요일에는 커뮤니티 이용 가능 시간이 등록되어 있지 않습니다." };
  }

  const operating = space.operatingHours.find((item: SpaceOperatingHour) => item.dayOfWeek === meeting.dayOfWeek);
  const operationMatches = Boolean(operating?.isOpen)
    && contains(operating?.startTime, operating?.endTime, meeting.start, meeting.end);
  const breakConflict = operating ? overlapsBreak(operating, meeting.start, meeting.end) : false;
  if (availabilityMatches && operationMatches && !breakConflict) {
    return { status: "available" as const, label: "바로 이용 가능" as const, summary: "선택한 일정이 운영 시간과 커뮤니티 이용 가능 시간에 모두 포함됩니다." };
  }
  if (breakConflict) {
    return { status: "adjustment_required" as const, label: "시간 조정 필요" as const, summary: `선택한 일정이 브레이크 타임 ${operating?.breakStartTime}~${operating?.breakEndTime}과 겹칩니다.` };
  }
  return {
    status: "adjustment_required" as const,
    label: "시간 조정 필요" as const,
    summary: availability ? `이 공간의 커뮤니티 이용 가능 시간은 ${availability.startTime}~${availability.endTime}입니다.` : "선택한 요일의 이용 가능 시간을 운영자와 조정해야 합니다.",
  };
}

function spaceCapabilityTags(space: Space) {
  const tags = [...space.facilities, ...space.moods, ...space.suitableActivities];
  if (space.parkingAvailable) tags.push("주차", "주차 가능");
  if (space.foodAllowed) tags.push("음식 반입 가능", "음식 가능");
  if (includes(space.facilities, "와이파이")) tags.push("Wi-Fi");
  if (includes(space.facilities, "주방")) tags.push("주방 사용 가능");
  if (includes(space.facilities, "테이블")) tags.push("테이블");
  if (space.noiseLevel === "quiet") tags.push("조용한 공간", "조용한");
  if (includes(space.suitableActivities, "촬영")) tags.push("촬영 가능");
  return tags;
}

export function scoreCommunitySpaces(spaces: Space[], input: CommunitySpaceRecommendationInput): CommunitySpaceRecommendation[] {
  return spaces
    .filter((space) => space.status === "approved")
    .filter((space) => space.maxCapacity >= input.capacity)
    .filter((space) => !space.difficultActivities.some((activity) => normalize(`${input.category} ${input.activityDescription}`).includes(normalize(activity))))
    .map((space) => {
      const locationMatches = space.detailedRegion === input.detailedRegion || (input.detailedRegion === "기타" && space.customRegion === input.customRegion);
      const regionScore = locationMatches ? 22 : input.detailedRegion === "기타" ? 2 : 8;
      const capacityScore = input.capacity >= space.minCapacity ? 16 : 8;
      const capabilities = spaceCapabilityTags(space);
      const foodDrinkMatches = !input.foodDrinkNeeded || space.foodAllowed || includes(capabilities, "음료") || normalize(space.spaceType).includes("카페");
      const facilityRequirements = [...input.facilities, ...(input.foodDrinkNeeded ? ["음식·음료 이용"] : [])];
      const facilityMatches = facilityRequirements.filter((facility) => facility === "음식·음료 이용" ? foodDrinkMatches : includes(capabilities, facility));
      const facilityScore = facilityRequirements.length ? Math.round(22 * facilityMatches.length / facilityRequirements.length) : 22;
      const missingFacilities = facilityRequirements.filter((item) => !facilityMatches.includes(item));
      const totalPrice = space.pricePerHour * Math.max(1, input.expectedDurationHours);
      const budgetMatches = !input.budgetMax || totalPrice <= input.budgetMax;
      const budgetScore = budgetMatches ? 12 : Math.max(0, Math.round(12 * input.budgetMax / Math.max(1, totalPrice)));
      const moodMatches = input.moods.filter((mood) => includes(capabilities, mood));
      const moodScore = input.moods.length ? Math.round(10 * moodMatches.length / input.moods.length) : 10;
      const activityText = `${input.category} ${input.activityDescription}`;
      const activityMatches = space.suitableActivities.filter((activity) => normalize(activityText).includes(normalize(activity)) || normalize(activity).includes(normalize(input.category)));
      const activityScore = activityMatches.length ? 10 : 2;
      const availability = timeStatus(space, input);
      const timeScore = availability.status === "available" ? 8 : availability.status === "adjustment_required" ? 3 : 1;
      const score = Math.max(0, regionScore + capacityScore + facilityScore + budgetScore + moodScore + activityScore + timeScore - missingFacilities.length * 8);
      const matches = [
        ...(locationMatches ? ["선택 지역과 일치"] : []),
        ...(input.capacity >= space.minCapacity ? [`${input.capacity}명 이용 가능`] : []),
        ...facilityMatches.map((item) => item === "음식·음료 이용" ? "음식·음료 조건 충족" : `${item} 있음`),
        ...moodMatches.map((item) => `${item} 분위기`),
        ...(budgetMatches ? ["예산 범위 충족"] : []),
        ...(activityMatches.length ? ["활동 유형과 적합"] : []),
        ...(availability.status === "available" ? ["선택한 일정에 바로 이용 가능"] : []),
      ];
      const reasons = matches.length ? matches.slice(0, 4) : ["일부 조건을 조정하면 이용할 수 있는 공간입니다."];
      const fitLabel: CommunitySpaceRecommendation["fitLabel"] = score >= 82
        ? "조건이 잘 맞아요"
        : score >= 62
          ? "대부분의 조건이 맞아요"
          : "일부 조건 조정이 필요해요";
      return {
        id: space.id,
        slug: space.slug,
        name: space.name,
        thumbnailUrl: space.thumbnailUrl ?? space.images[0]?.publicUrl,
        location: `${space.mainRegion} · ${space.detailedRegion === "기타" ? space.customRegion || "기타" : space.detailedRegion}`,
        pricePerHour: space.pricePerHour,
        totalPrice,
        maxCapacity: space.maxCapacity,
        facilities: space.facilities,
        score,
        fitLabel,
        availabilityStatus: availability.status,
        availabilityLabel: availability.label,
        availabilitySummary: availability.summary,
        reasons,
        matches,
        details: toPublicSpaceDetail(space),
      };
    })
    .sort((a, b) => {
      const rank = { available: 2, adjustment_required: 1, consultation_required: 0 };
      return b.score - a.score || rank[b.availabilityStatus] - rank[a.availabilityStatus] || a.totalPrice - b.totalPrice;
    })
    .slice(0, 5);
}
