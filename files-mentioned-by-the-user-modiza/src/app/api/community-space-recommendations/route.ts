import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { requireApiUser, apiAuthStatus } from "@/lib/auth/api";
import { communityCategories, subRegions } from "@/constants/taxonomy";
import { scoreCommunitySpaces } from "@/lib/space/communityRecommendation";
import { getActiveSpaces } from "@/repositories/spaceRepository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OPENAI_RECOMMENDATION_MODEL, SPACE_ANALYSIS_TIMEOUT_MS } from "@/config/openai";
import { RecommendationReasonsSchema } from "@/types/space-recommendation";
import { getCachedRecommendationReasons, saveRecommendationReasons } from "@/repositories/spaceRecommendationRepository";

const schema = z.object({ category: z.enum(communityCategories), activityDescription: z.string().max(2000), moods: z.array(z.string()).max(20), capacity: z.number().int().min(1).max(1000), facilities: z.array(z.string()).max(30), detailedRegion: z.enum(subRegions), customRegion: z.string().max(80).optional(), budgetMax: z.number().int().min(0), expectedDurationHours: z.number().min(.5).max(24) });

export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "추천 조건을 확인해 주세요." }, { status: 400 });
    const results = scoreCommunitySpaces(await getActiveSpaces(supabase), parsed.data);
    if (!results.length) return NextResponse.json({ results, explanationAvailable: false });
    const hash = createHash("sha256").update(JSON.stringify({ input: parsed.data, results: results.map(({ id, score, matches }) => ({ id, score, matches })) })).digest("hex");
    let reasons = new Map<string,string>();
    try { reasons = await getCachedRecommendationReasons(createAdminSupabaseClient(), hash, results.map((space) => space.id)); } catch (error) { console.error("[MODIZA][community recommendation] cache read failed", error); }
    const missing = results.filter((space) => !reasons.has(space.id));
    if (missing.length && process.env.OPENAI_API_KEY) {
      try {
        const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: SPACE_ANALYSIS_TIMEOUT_MS }).responses.parse({ model: OPENAI_RECOMMENDATION_MODEL, input: [{ role:"system", content:"규칙 기반으로 이미 확정된 공간 추천 순위는 변경하지 말고, 실제 일치 근거만 사용해 각 공간의 한국어 추천 이유를 2문장 이내로 작성하세요." }, { role:"user", content:JSON.stringify({ conditions:parsed.data, selectedSpaces:missing.map((space) => ({ spaceId:space.id, name:space.name, score:space.score, evidence:space.matches })) }) }], text:{ format:zodTextFormat(RecommendationReasonsSchema,"community_space_reasons") } });
        const generated = response.output_parsed?.recommendations ?? [];
        generated.forEach((item) => reasons.set(item.spaceId,item.reason));
        try { await saveRecommendationReasons(createAdminSupabaseClient(), hash, generated); } catch (error) { console.error("[MODIZA][community recommendation] cache write failed", error); }
      } catch (error) { console.error("[MODIZA][community recommendation] OpenAI explanation failed", error); }
    }
    return NextResponse.json({ results: results.map((space) => ({ ...space, aiReason: reasons.get(space.id), reasons: reasons.has(space.id) ? [reasons.get(space.id)!, ...space.reasons] : space.reasons })), explanationAvailable: results.every((space) => reasons.has(space.id)) });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    console.error("[MODIZA][community recommendation] failed", error);
    return NextResponse.json({ message: status === 500 ? "공간 추천을 불러오지 못했어요." : "로그인 또는 운영자 권한이 필요해요." }, { status });
  }
}
