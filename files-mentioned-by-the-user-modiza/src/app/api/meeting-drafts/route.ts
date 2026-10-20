import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { OPENAI_MEETING_DRAFT_MODEL, SPACE_ANALYSIS_TIMEOUT_MS } from "@/config/openai";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { MeetingAiAnswersSchema, MeetingAiDraftSchema } from "@/types/meeting";

const systemPrompt = `당신은 오프라인 모임 운영 SaaS MODIZA의 모임 초안 도우미입니다.
운영자가 제공한 목적, 참여 대상, 진행 방식, 분위기, 참고사항만 사용해 한국어 모임 초안을 작성하세요.
결과는 저장되는 완성본이 아니라 운영자가 반드시 검토하고 수정하는 초안입니다.
사용자가 말하지 않은 날짜, 시간, 장소, 가격, 정원, 혜택을 임의로 만들지 마세요.
모임 이름, 한 줄 소개, 상세 소개, 준비물 안내만 작성하세요.
과장하거나 참여를 압박하지 말고 구체적이고 따뜻한 어조를 사용하세요.`;

export async function POST(request: Request) {
  try {
    await requireApiUser("community_host");
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ message: "지금은 AI 초안 기능을 사용할 수 없어요. 직접 작성으로 계속해 주세요." }, { status: 503 });
    }
    const answers = MeetingAiAnswersSchema.parse(await request.json());
    const response = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: SPACE_ANALYSIS_TIMEOUT_MS,
    }).responses.parse({
      model: OPENAI_MEETING_DRAFT_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(answers) },
      ],
      text: { format: zodTextFormat(MeetingAiDraftSchema, "modiza_meeting_draft") },
    });
    if (!response.output_parsed) throw new Error("EMPTY_MEETING_DRAFT");
    return NextResponse.json({ draft: response.output_parsed });
  } catch (error) {
    console.error("[MODIZA][meeting-draft] failed", error);
    return NextResponse.json(
      { message: "AI 초안을 만들지 못했어요. 입력 내용을 확인하거나 직접 작성으로 계속해 주세요." },
      { status: apiAuthStatus(error) ?? 500 },
    );
  }
}
