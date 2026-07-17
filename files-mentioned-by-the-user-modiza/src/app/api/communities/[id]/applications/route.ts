import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createApplication } from "@/repositories/applicationRepository";
import { getCommunityBySlug } from "@/repositories/communityRepository";
import { CreateCommunityApplicationSchema } from "@/types/community";

function localDebugSuffix(error: unknown) {
  if (process.env.VERCEL_ENV === "production") return "";
  const value = error as { code?: string; message?: string; details?: string };
  const details = value?.details ? ` / ${value.details}` : "";
  return ` [${value?.code ?? "UNKNOWN"}] ${value?.message ?? String(error)}${details}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser();
    const parsed = CreateCommunityApplicationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "신청 정보를 다시 확인해 주세요." }, { status: 400 });
    const id = (await params).id;
    const { data: row, error } = await supabase.from("communities").select("*").eq("id", id).eq("status", "published").maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ message: "참여 신청할 수 없는 커뮤니티예요." }, { status: 404 });
    const community = await getCommunityBySlug(supabase, row.slug);
    if (!community || community.recruitmentStatus !== "recruiting") return NextResponse.json({ message: "현재 모집 중인 커뮤니티가 아니에요." }, { status: 400 });
    if (community.recruitmentStartAt && new Date(community.recruitmentStartAt) > new Date()) return NextResponse.json({ message: "아직 모집이 시작되지 않았어요. 모집 시작일 이후에 신청해 주세요." }, { status: 400 });
    if (community.recruitmentEndAt && new Date(community.recruitmentEndAt) <= new Date()) return NextResponse.json({ message: "현재 모집이 마감되었어요." }, { status: 400 });
    if (community.currentMembers >= community.capacity) return NextResponse.json({ message: "모집 정원이 모두 찼어요." }, { status: 400 });
    const application = await createApplication(supabase, community.id, community.name, parsed.data);
    return NextResponse.json({ communityName: community.name, nextMeetingAt: community.nextMeetingAt, status: application.status }, { status: 201 });
  } catch (error) {
    const authStatus = apiAuthStatus(error);
    if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "로그인이 필요해요." }, { status: authStatus });
    if (error instanceof Error && error.message === "DUPLICATE_APPLICATION") return NextResponse.json({ message: "이미 검토 중이거나 승인된 신청이 있어요." }, { status: 409 });
    console.error("[MODIZA][application] create failed", error);
    return NextResponse.json({ message: `참여 신청을 저장하지 못했어요.${localDebugSuffix(error)}` }, { status: 500 });
  }
}
