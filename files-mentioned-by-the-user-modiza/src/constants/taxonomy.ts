export const PRIMARY_REGION = "대구 전체" as const;

export const subRegions = [
  "중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "기타",
] as const;
export type SubRegion = (typeof subRegions)[number];

export const communityCategories = [
  "문화·예술", "운동·스포츠", "취미", "자기계발", "독서", "음악",
  "영화", "맛집·카페", "여행", "네트워킹", "봉사", "기타",
] as const;
export type CommunityCategory = (typeof communityCategories)[number];

export const interestCategories = communityCategories.filter((category) => category !== "기타");
export const communityMoods = ["조용한", "따뜻한", "아늑한", "감각적인", "활동적인", "밝은", "미니멀", "자유로운"] as const;
export const communityFacilities = ["프로젝터", "화이트보드", "긴 테이블", "주차", "스피커", "마이크", "와이파이", "콘센트"] as const;

export function normalizeSubRegion(value?: string | null): SubRegion {
  if (!value) return "기타";
  if (value === "수성") return "수성구";
  if (value === "달성") return "달성군";
  return subRegions.includes(value as SubRegion) ? value as SubRegion : "기타";
}

export function formatRegion(primary: string = PRIMARY_REGION, sub?: string | null, custom?: string | null) {
  const detail = sub === "기타" ? custom?.trim() || "기타" : sub;
  return detail ? `${primary} · ${detail}` : primary;
}

export function categoryQueryValue(category: string) {
  return encodeURIComponent(category);
}
