import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { OPENAI_VISION_MODEL, SPACE_ANALYSIS_TIMEOUT_MS } from "@/config/openai";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { SpaceAnalysisSchema } from "@/types/space-analysis";

const prompt = `업로드된 사진들은 같은 공간을 서로 다른 각도에서 촬영한 것입니다. 사진에서 실제로 확인되는 내용만 한국어 JSON으로 분석하세요. 공간 유형, 분위기, 인테리어 스타일, 보이는 시설과 신뢰도, 적합한 활동, 좌석 형태, 밝기, 사진상 예상 수용 범위와 신뢰도, 프라이버시 구조, 소음 관련 확인 필요 여부, 짧은 분석 설명과 2~3문장 소개를 반환하세요. 실제 Wi-Fi 제공, 정확한 소음 수준과 최대 수용 인원, 주차 가능 여부, 시설 작동 여부, 음식 반입, 정확한 프라이버시 수준, 예약 시간과 운영 규칙은 확정하지 마세요. 사진으로 판단하기 어렵다면 해당 값에 '확인 필요' 또는 '판단 어려움'을 사용하고 warnings에도 적으세요. 보이지 않는 시설을 만들지 마세요.`;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let fileInfo: Array<{ name?: string; type?: string; size?: number }> = [];
  try {
    await requireApiUser("space_host");
    if (!process.env.OPENAI_API_KEY) {
      console.error("[MODIZA][draft-space-analysis] OPENAI_API_KEY is not configured");
      return NextResponse.json({ message: "AI 분석을 사용할 수 없어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }

    const form = await request.formData();
    const images = form.getAll("images").filter((item): item is File => item instanceof File);
    if (!images.length) return NextResponse.json({ message: "분석할 공간 사진을 선택해 주세요." }, { status: 400 });
    if (images.length < 5) return NextResponse.json({ message: "분석을 위해 사진을 최소 5장 올려주세요." }, { status: 400 });
    if (images.length > 10) return NextResponse.json({ message: "사진은 최대 10장까지 등록할 수 있어요." }, { status: 400 });
    fileInfo = images.map((image) => ({ name: image.name, type: image.type, size: image.size }));
    if (images.some((image) => !allowedTypes.has(image.type))) return NextResponse.json({ message: "JPG, PNG, WebP 사진만 분석할 수 있어요." }, { status: 400 });
    if (images.some((image) => image.size > 10_485_760)) return NextResponse.json({ message: "사진 한 장의 용량은 최대 10MB까지 가능합니다." }, { status: 400 });

    const imageInputs = await Promise.all(images.map(async (image) => ({
      type: "input_image" as const,
      image_url: `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`,
      detail: "low" as const,
    })));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: SPACE_ANALYSIS_TIMEOUT_MS, maxRetries: 0 });
    const response = await client.responses.parse({
      model: OPENAI_VISION_MODEL,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...imageInputs] }],
      text: { format: zodTextFormat(SpaceAnalysisSchema, "space_registration_draft_analysis") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no parsed analysis", { cause: response.output });
    return NextResponse.json({ analysis: SpaceAnalysisSchema.parse(response.output_parsed) });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    console.error("[MODIZA][draft-space-analysis] request failed", {
      files: fileInfo,
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      code: error instanceof OpenAI.APIError ? error.code : undefined,
      type: error instanceof OpenAI.APIError ? error.type : undefined,
      message: error instanceof Error ? error.message : String(error),
      responseBody: error instanceof OpenAI.APIError ? error.error : undefined,
    });
    return NextResponse.json({ message: error instanceof OpenAI.APIError ? "모디자가 사진을 분석하지 못했어요. 다시 시도하거나 직접 작성해주세요." : "현재 사진 분석 기능을 잠시 사용할 수 없어요. 직접 작성으로 공간을 등록할 수 있습니다." }, { status: error instanceof OpenAI.APIError ? 502 : 500 });
  }
}
