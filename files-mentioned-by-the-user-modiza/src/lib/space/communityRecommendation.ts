import type { Space } from "@/types/space";

export type CommunitySpaceRecommendationInput = { category: string; activityDescription: string; moods: string[]; capacity: number; facilities: string[]; detailedRegion: string; customRegion?: string; budgetMax: number; expectedDurationHours: number };
export type CommunitySpaceRecommendation = { id: string; slug: string; name: string; thumbnailUrl?: string | null; location: string; pricePerHour: number; totalPrice: number; maxCapacity: number; facilities: string[]; score: number; reasons: string[]; matches: string[]; aiReason?: string };

const normalize = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
const includes = (values: string[], target: string) => values.some((value) => normalize(value).includes(normalize(target)) || normalize(target).includes(normalize(value)));

export function scoreCommunitySpaces(spaces: Space[], input: CommunitySpaceRecommendationInput): CommunitySpaceRecommendation[] {
  return spaces.filter((space) => space.status === "active").map((space) => {
    const locationMatches = space.detailedRegion === input.detailedRegion || (input.detailedRegion === "기타" && space.customRegion === input.customRegion);
    const regionScore = locationMatches ? 30 : input.detailedRegion === "기타" ? 5 : 10;
    const capacityScore = space.maxCapacity >= input.capacity ? 20 : Math.max(0, Math.round(20 * space.maxCapacity / Math.max(1, input.capacity)));
    const facilityMatches = input.facilities.filter((facility) => includes(space.parkingAvailable ? [...space.facilities, "주차"] : space.facilities, facility));
    const facilityScore = input.facilities.length ? Math.round(20 * facilityMatches.length / input.facilities.length) : 20;
    const totalPrice = space.pricePerHour * Math.max(1, input.expectedDurationHours);
    const budgetScore = !input.budgetMax || totalPrice <= input.budgetMax ? 15 : Math.max(0, Math.round(15 * input.budgetMax / totalPrice));
    const moodMatches = input.moods.filter((mood) => includes(space.moods, mood));
    const moodScore = input.moods.length ? Math.round(10 * moodMatches.length / input.moods.length) : 10;
    const activityText = `${input.category} ${input.activityDescription}`;
    const activityMatches = space.suitableActivities.filter((activity) => normalize(activityText).includes(normalize(activity)) || normalize(activity).includes(normalize(input.category)));
    const activityScore = activityMatches.length ? 5 : 0;
    const score = regionScore + capacityScore + facilityScore + budgetScore + moodScore + activityScore;
    const matches = [...(locationMatches ? ["희망 지역 일치"] : []), ...(space.maxCapacity >= input.capacity ? ["수용 인원 적합"] : []), ...facilityMatches.map((item) => `${item} 있음`), ...moodMatches.map((item) => `${item} 분위기`), ...(budgetScore === 15 ? ["예산 충족"] : []), ...(activityMatches.length ? ["활동 유형 적합"] : [])];
    const reasons = matches.length ? matches.slice(0, 3) : ["일부 조건을 조정하면 이용 가능한 공간입니다."];
    return { id: space.id, slug: space.slug, name: space.name, thumbnailUrl: space.thumbnailUrl ?? space.images[0]?.publicUrl, location: `${space.mainRegion} · ${space.detailedRegion === "기타" ? space.customRegion || "기타" : space.detailedRegion}`, pricePerHour: space.pricePerHour, totalPrice, maxCapacity: space.maxCapacity, facilities: space.facilities, score, reasons, matches };
  }).sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice).slice(0, 5);
}
