import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { requireApiUser, apiAuthStatus } from "@/lib/auth/api";
import { OPENAI_COMMUNITY_DRAFT_MODEL, SPACE_ANALYSIS_TIMEOUT_MS } from "@/config/openai";
import { CommunityDraftAnswersSchema, CommunityDraftSchema } from "@/types/communityDraft";

const systemPrompt = `당신은 대구 지역 커뮤니티 플랫폼 MODIZA의 등록 도우미입니다.
사용자의 다섯 답변만 바탕으로 커뮤니티 등록에 사용할 한국어 초안을 작성하세요.
친근하고 구체적이되 과장하지 말고, 사용자가 말하지 않은 운영 조건이나 혜택을 만들지 마세요.
결과는 완성본이 아니라 사용자가 검토하고 선택 적용할 초안입니다.
커뮤니티 이름, 한 줄 소개, 상세 소개, 모집글, 신청 질문 1~3개, 추천 태그 3~6개만 생성하세요.
운영 체크리스트, 공지, 준비물, 세부 일정, 가격, 장소, 연락처는 생성하지 마세요.
상세 소개에는 모임의 목적, 예상 진행 방식, 함께하고 싶은 사람을 자연스럽게 포함하세요.
모집글은 참여를 강요하지 않는 따뜻한 어조로 3~5문장 이내로 작성하세요.`;

export async function POST(request: Request) {
  try {
    await requireApiUser();
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ message: "지금은 초안 만들기 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }
    const answers = CommunityDraftAnswersSchema.parse(await request.json());
    const response = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: SPACE_ANALYSIS_TIMEOUT_MS,
    }).responses.parse({
      model: OPENAI_COMMUNITY_DRAFT_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(answers) },
      ],
      text: { format: zodTextFormat(CommunityDraftSchema, "modiza_community_draft") },
    });
    const draft = response.output_parsed;
    if (!draft) throw new Error("EMPTY_DRAFT");
    return NextResponse.json({ draft });
  } catch (error) {
    console.error("[MODIZA][community-draft] failed", error);
    return NextResponse.json(
      { message: "초안을 정리하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요." },
      { status: apiAuthStatus(error) ?? 500 },
    );
  }
}
