import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  OPENAI_VISION_MODEL,
  SPACE_ANALYSIS_TIMEOUT_MS,
} from "@/config/openai";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import {
  applySpaceAnalysis,
  getSpaceAnalysis,
  saveSpaceAnalysis,
} from "@/repositories/spaceAnalysisRepository";
import { getMySpaceById } from "@/repositories/spaceRepository";
import { SpaceAnalysisSchema } from "@/types/space-analysis";

const prompt = `업로드된 공간 사진만 관찰해 한국어 JSON으로 분석하세요. 공간 유형, 분위기, 인테리어 스타일, 사진에서 실제로 보이는 시설, 적합한 활동, 사진상 추정 적정 인원 범위와 신뢰도, 2~3문장 소개, 경고를 반환하세요. 가격, 주차, 예약시간, 최대 수용인원, 운영규칙, 음식/주류, 면적, 안전시설은 추측하지 말고 warnings에 '확인 필요'로 적으세요. 보이지 않는 시설을 만들지 마세요.`;

type ImageCheck = {
  url: string;
  ok: boolean;
  status?: number;
  contentType?: string | null;
  error?: string;
};

type Diagnostic = {
  status?: number;
  code?: string | null;
  type?: string | null;
  message: string;
  responseBody?: unknown;
  requestId?: string | null;
  imageUrls: string[];
  imageChecks: ImageCheck[];
  apiKeyConfigured: boolean;
};

async function checkPublicImages(imageUrls: string[]): Promise<ImageCheck[]> {
  return Promise.all(
    imageUrls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        const contentType = response.headers.get("content-type");
        return {
          url,
          status: response.status,
          contentType,
          ok: response.ok && Boolean(contentType?.startsWith("image/")),
        };
      } catch (error) {
        return {
          url,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

function createDiagnostic(
  error: unknown,
  imageUrls: string[],
  imageChecks: ImageCheck[],
): Diagnostic {
  const apiKeyConfigured = Boolean(process.env.OPENAI_API_KEY);

  if (error instanceof OpenAI.APIError) {
    return {
      status: error.status,
      code: error.code,
      type: error.type,
      message: error.message,
      responseBody: error.error,
      requestId: error.requestID,
      imageUrls,
      imageChecks,
      apiKeyConfigured,
    };
  }

  if (error instanceof Error) {
    const cause = error.cause;
    return {
      message: error.message,
      responseBody:
        cause instanceof Error
          ? { name: cause.name, message: cause.message }
          : cause,
      imageUrls,
      imageChecks,
      apiKeyConfigured,
    };
  }

  return {
    message: String(error),
    responseBody: error,
    imageUrls,
    imageChecks,
    apiKeyConfigured,
  };
}

function failureResponse(diagnostic: Diagnostic, status = 500) {
  console.error("[MODIZA][space-analysis] OpenAI request failed", diagnostic);
  return NextResponse.json(
    {
      message: "AI가 공간을 분석하지 못했어요. 잠시 후 다시 시도해 주세요.",
    },
    { status },
  );
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireApiUser("space_host");
    const result = await getSpaceAnalysis(
      supabase,
      (await params).id,
    );
    return NextResponse.json(result);
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    console.error("[MODIZA][space-analysis] Failed to load analysis", error);
    return NextResponse.json(
      { message: "분석 결과를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let imageUrls: string[] = [];
  let imageChecks: ImageCheck[] = [];

  try {
    const { supabase: db } = await requireApiUser("space_host");
    if (!process.env.OPENAI_API_KEY) {
      return failureResponse(
        createDiagnostic(
          new Error("OPENAI_API_KEY is not configured"),
          imageUrls,
          imageChecks,
        ),
        503,
      );
    }

    const id = (await params).id;
    const space = await getMySpaceById(db, id);
    if (!space?.images.length) {
      return NextResponse.json(
        { message: "분석할 공간 사진이 필요해요." },
        { status: 400 },
      );
    }

    imageUrls = space.images.map((image) => image.publicUrl);
    imageChecks = await checkPublicImages(imageUrls);
    if (imageChecks.some((check) => !check.ok)) {
      return failureResponse(
        createDiagnostic(
          new Error("One or more image URLs are not publicly accessible images"),
          imageUrls,
          imageChecks,
        ),
        424,
      );
    }

    console.info("[MODIZA][space-analysis] Image URL accessibility check", {
      imageChecks,
      apiKeyConfigured: true,
    });

    const { force = false } = await req.json().catch(() => ({ force: false }));
    const signature = createHash("sha256")
      .update(
        space.images
          .map((image) => image.storagePath)
          .sort()
          .join("|"),
      )
      .digest("hex");
    const existing = await getSpaceAnalysis(db, id);
    if (existing && existing.imageSignature === signature && !force) {
      return NextResponse.json({ ...existing, cached: true });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: SPACE_ANALYSIS_TIMEOUT_MS,
    });
    const response = await client.responses.parse({
      model: OPENAI_VISION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...imageUrls.map((imageUrl) => ({
              type: "input_image" as const,
              image_url: imageUrl,
              detail: "low" as const,
            })),
          ],
        },
      ],
      text: { format: zodTextFormat(SpaceAnalysisSchema, "space_analysis") },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed analysis", {
        cause: response.output,
      });
    }

    const saved = await saveSpaceAnalysis(
      db,
      id,
      response.output_parsed,
      signature,
      OPENAI_VISION_MODEL,
    );
    return NextResponse.json({ ...saved, cached: false });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    const diagnostic = createDiagnostic(error, imageUrls, imageChecks);
    return failureResponse(diagnostic, error instanceof OpenAI.APIError ? 502 : 500);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase: db } = await requireApiUser("space_host");
    const id = (await params).id;
    const analysis = SpaceAnalysisSchema.parse(await req.json());
    const space = await getMySpaceById(db, id);
    if (!space) throw new Error("Space not found");
    const signature = createHash("sha256")
      .update(
        space.images
          .map((image) => image.storagePath)
          .sort()
          .join("|"),
      )
      .digest("hex");
    await saveSpaceAnalysis(
      db,
      id,
      analysis,
      signature,
      OPENAI_VISION_MODEL,
    );
    await applySpaceAnalysis(db, id, analysis);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    console.error("[MODIZA][space-analysis] Failed to save analysis", error);
    return NextResponse.json(
      { message: "분석 결과를 저장하지 못했어요." },
      { status: 400 },
    );
  }
}
