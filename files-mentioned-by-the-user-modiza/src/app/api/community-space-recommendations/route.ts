import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, apiAuthStatus } from "@/lib/auth/api";
import { communityCategories, subRegions } from "@/constants/taxonomy";
import { scoreCommunitySpaces } from "@/lib/space/communityRecommendation";
import { getActiveSpaces } from "@/repositories/spaceRepository";

const schema = z.object({
  category: z.enum(communityCategories),
  activityDescription: z.string().max(2000),
  moods: z.array(z.string()).max(20),
  capacity: z.number().int().min(1).max(1000),
  facilities: z.array(z.string()).max(30),
  foodDrinkNeeded: z.boolean(),
  detailedRegion: z.enum(subRegions),
  customRegion: z.string().max(80).optional(),
  budgetMax: z.number().int().min(0),
  expectedDurationHours: z.number().min(.5).max(24),
  meetingStartAt: z.string().min(10).max(40),
  meetingEndAt: z.string().min(10).max(40).optional(),
  meetingFrequencyType: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "추천 조건을 확인해 주세요." }, { status: 400 });
    const results = scoreCommunitySpaces(await getActiveSpaces(supabase), parsed.data);
    return NextResponse.json({
      results,
      recommendationType: "rule_based",
      message: "입력한 커뮤니티 조건과 등록 공간 정보를 규칙으로 비교한 결과입니다.",
    });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    console.error("[MODIZA][community recommendation] failed", error);
    return NextResponse.json({
      message: status === 500 ? "공간 추천을 불러오지 못했어요." : "로그인 또는 운영자 권한이 필요해요.",
    }, { status });
  }
}
