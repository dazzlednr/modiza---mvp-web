export const PRIMARY_REGION = "대구" as const;

export const subRegions = [
  "중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군", "기타",
] as const;
export type SubRegion = (typeof subRegions)[number];

export const communityCategories = [
  "운동·스포츠", "취미", "사교·네트워킹", "독서·인문", "문화·예술",
  "음악·악기", "여행·나들이", "맛집·카페", "외국어", "커리어·직무",
  "창업·사이드프로젝트", "자기계발", "게임·보드게임", "사진·영상",
  "공예·만들기", "요리·베이킹", "봉사", "반려동물", "클래스",
] as const;
export type CommunityCategory = (typeof communityCategories)[number];

export const interestCategories = communityCategories;

const legacyCommunityCategoryMap: Record<string, CommunityCategory> = {
  독서: "독서·인문",
  음악: "음악·악기",
  영화: "문화·예술",
  여행: "여행·나들이",
  네트워킹: "사교·네트워킹",
  기타: "취미",
};

export function normalizeCommunityCategory(value?: string | null): CommunityCategory {
  if (value && communityCategories.includes(value as CommunityCategory)) return value as CommunityCategory;
  return legacyCommunityCategoryMap[value ?? ""] ?? "취미";
}

export function normalizeCommunityCategories(values: readonly string[]): CommunityCategory[] {
  return [...new Set(values.map((value) => normalizeCommunityCategory(value)))];
}
export const communityMoods = [
  "편안한", "조용한", "활발한", "자유로운", "친목 중심", "자기계발",
  "진지한 토론", "소규모", "감성적인", "캐주얼", "네트워킹", "초보 환영",
] as const;
export const communityFacilities = [
  "Wi-Fi", "콘센트", "화이트보드", "빔프로젝터", "모니터/TV", "스피커", "마이크",
  "테이블", "의자", "주차 가능", "음식 반입 가능", "음료 제공", "조용한 공간",
  "냉난방", "화장실", "주방 사용 가능", "촬영 가능", "악기 사용 가능", "반려동물 가능",
] as const;

export function normalizeSubRegion(value?: string | null): SubRegion {
  if (!value) return "기타";
  if (value === "수성") return "수성구";
  if (value === "달성") return "달성군";
  return subRegions.includes(value as SubRegion) ? value as SubRegion : "기타";
}

export function formatRegion(primary: string = PRIMARY_REGION, sub?: string | null, custom?: string | null) {
  const detail = sub === "기타" ? custom?.trim() || "기타" : sub;
  const normalizedPrimary = primary === "대구 전체" ? PRIMARY_REGION : primary;
  return detail ? `${normalizedPrimary} · ${detail}` : normalizedPrimary;
}

export function categoryQueryValue(category: string) {
  return encodeURIComponent(category);
}
