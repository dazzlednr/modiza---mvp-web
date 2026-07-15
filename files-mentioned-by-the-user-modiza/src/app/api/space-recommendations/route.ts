import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  OPENAI_RECOMMENDATION_MODEL,
  SPACE_ANALYSIS_TIMEOUT_MS,
} from "@/config/openai";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import {
  getCachedRecommendationReasons,
  saveRecommendationReasons,
} from "@/repositories/spaceRecommendationRepository";
import { getActiveSpaces } from "@/repositories/spaceRepository";
import { recommendSpaces } from "@/services/space-recommendation";
import {
  RecommendationReasonsSchema,
  SpaceRecommendationInputSchema,
} from "@/types/space-recommendation";

function conditionHash(input: unknown, spaces: unknown) {
  return createHash("sha256")
    .update(JSON.stringify({ input, spaces }))
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const parsed = SpaceRecommendationInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "추천 조건을 다시 확인해 주세요." },
        { status: 400 },
      );
    }

    const cacheDb = createAdminSupabaseClient();
    const spaces = await getActiveSpaces(supabase);
    const recommendation = recommendSpaces(spaces, parsed.data);
    if (!recommendation.results.length) {
      return NextResponse.json({
        results: [],
        ...(process.env.NODE_ENV === "development"
          ? { exclusions: recommendation.exclusions }
          : {}),
        explanationAvailable: false,
      });
    }

    const hash = conditionHash(
      {
        ...parsed.data,
        facilities: [...parsed.data.facilities].sort(),
        moods: [...parsed.data.moods].sort(),
      },
      recommendation.results.map((space) => ({
        id: space.id,
        score: space.score,
        evidence: space.evidence,
        price: space.pricePerHour,
      })),
    );

    let reasons = new Map<string, string>();
    try {
      reasons = await getCachedRecommendationReasons(
        cacheDb,
        hash,
        recommendation.results.map((space) => space.id),
      );
    } catch (error) {
      console.error("[MODIZA][recommendation] Reason cache read failed", error);
    }

    const missing = recommendation.results.filter((space) => !reasons.has(space.id));
    if (missing.length && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: SPACE_ANALYSIS_TIMEOUT_MS,
        });
        const response = await openai.responses.parse({
          model: OPENAI_RECOMMENDATION_MODEL,
          input: [
            {
              role: "system",
              content:
                "당신은 모디자의 한국어 문장 작성 도우미입니다. 이미 확정된 규칙 기반 추천 결과를 바꾸거나 순위를 평가하지 말고, 제공된 조건과 공간 정보만 사용해 각 공간의 추천 이유를 2문장 이내로 작성하세요.",
            },
            {
              role: "user",
              content: JSON.stringify({
                conditions: parsed.data,
                selectedSpaces: missing.map((space) => ({
                  spaceId: space.id,
                  name: space.name,
                  region: space.region,
                  maxCapacity: space.maxCapacity,
                  pricePerHour: space.pricePerHour,
                  facilities: space.facilities,
                  moods: space.moods,
                  evidence: space.evidence,
                })),
              }),
            },
          ],
          text: {
            format: zodTextFormat(
              RecommendationReasonsSchema,
              "recommendation_reasons",
            ),
          },
        });

        const generated = response.output_parsed?.recommendations ?? [];
        for (const item of generated) reasons.set(item.spaceId, item.reason);
        try {
          await saveRecommendationReasons(cacheDb, hash, generated);
        } catch (error) {
          console.error("[MODIZA][recommendation] Reason cache write failed", error);
        }
      } catch (error) {
        console.error("[MODIZA][recommendation] OpenAI reason generation failed", {
          status: error instanceof OpenAI.APIError ? error.status : undefined,
          code: error instanceof OpenAI.APIError ? error.code : undefined,
          type: error instanceof OpenAI.APIError ? error.type : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (missing.length) {
      console.warn("[MODIZA][recommendation] OPENAI_API_KEY is not configured");
    }

    return NextResponse.json({
      results: recommendation.results.map((space) => ({
        ...space,
        reason: reasons.get(space.id),
      })),
      ...(process.env.NODE_ENV === "development"
        ? { exclusions: recommendation.exclusions }
        : {}),
      explanationAvailable: recommendation.results.every((space) =>
        reasons.has(space.id),
      ),
    });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    console.error("[MODIZA][recommendation] Recommendation failed", error);
    return NextResponse.json(
      { message: "공간 추천을 완료하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
