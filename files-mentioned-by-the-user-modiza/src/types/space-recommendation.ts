import { z } from "zod";
import { subRegions } from "@/constants/taxonomy";

export const meetingTypes = [
  "독서",
  "영화",
  "글쓰기",
  "네트워킹",
  "스터디",
  "공연",
  "원데이 클래스",
  "사진",
  "운동",
  "기타",
] as const;

export const recommendationRegions = subRegions;

export const recommendationFacilities = [
  "프로젝터",
  "화이트보드",
  "긴 테이블",
  "주차",
  "스피커",
  "마이크",
  "와이파이",
] as const;

export const recommendationMoods = [
  "조용한",
  "따뜻한",
  "감각적인",
  "활동적인",
  "밝은",
  "미니멀",
] as const;

export const SpaceRecommendationInputSchema = z.object({
  meetingType: z.enum(meetingTypes),
  capacity: z.number().int().min(1).max(1000),
  region: z.enum(recommendationRegions),
  budget: z.number().int().min(0),
  facilities: z.array(z.enum(recommendationFacilities)).default([]),
  moods: z.array(z.enum(recommendationMoods)).default([]),
  date: z.iso.date(),
});

export type SpaceRecommendationInput = z.infer<
  typeof SpaceRecommendationInputSchema
>;

export type RecommendationScoreBreakdown = {
  capacity: number;
  facilities: number;
  activity: number;
  region: number;
  mood: number;
  price: number;
  weekday: number;
};

export type SpaceRecommendationResult = {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl?: string | null;
  region: string;
  pricePerHour: number;
  maxCapacity: number;
  facilities: string[];
  moods: string[];
  score: number;
  scoreBreakdown: RecommendationScoreBreakdown;
  evidence: string[];
  reason?: string;
};

export type RecommendationExclusion = {
  spaceId: string;
  spaceName: string;
  reasons: string[];
};

export type SpaceRecommendationResponse = {
  results: SpaceRecommendationResult[];
  exclusions?: RecommendationExclusion[];
  explanationAvailable: boolean;
};

export const RecommendationReasonsSchema = z.object({
  recommendations: z.array(
    z.object({
      spaceId: z.string(),
      reason: z.string().min(1).max(240),
    }),
  ),
});
