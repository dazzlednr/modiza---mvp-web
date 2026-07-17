import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";

const validUrl = (value: string) => {
  try { const url = new URL(value.trim()); return url.protocol === "https:" && url.hostname === "open.kakao.com" && url.pathname.startsWith("/"); }
  catch { return false; }
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireApiUser();
    const communityId = (await params).id;
    const applicationId = new URL(request.url).searchParams.get("applicationId");
    const { data: community, error: communityError } = await supabase.from("communities").select("id,name,slug,owner_id").eq("id", communityId).maybeSingle();
    if (communityError) throw communityError;
    if (!community) return NextResponse.json({ message: "커뮤니티를 찾을 수 없어요." }, { status: 404 });
    const owner = community.owner_id === user.id;
    if (!owner) {
      if (!applicationId) return NextResponse.json({ message: "오픈채팅방을 확인할 권한이 없어요." }, { status: 403 });
      const { data: application, error } = await supabase.from("community_applications").select("id").eq("id", applicationId).eq("community_id", communityId).eq("applicant_user_id", user.id).eq("status", "approved").maybeSingle();
      if (error) throw error;
      if (!application) return NextResponse.json({ message: "참가가 확정된 이용자만 확인할 수 있어요." }, { status: 403 });
    }
    const { data, error } = await supabase.from("community_open_chats").select("open_chat_url,created_at,updated_at").eq("community_id", communityId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ communityName: community.name, communitySlug: community.slug, registered: Boolean(data), openChatUrl: data?.open_chat_url ?? null, updatedAt: data?.updated_at ?? null, owner });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: status === 401 ? "로그인이 필요해요." : "오픈채팅방 정보를 불러오지 못했어요." }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const openChatUrl = String((await request.json()).openChatUrl ?? "").trim();
    if (!validUrl(openChatUrl)) return NextResponse.json({ message: "올바른 카카오톡 오픈채팅방 링크를 입력해주세요." }, { status: 400 });
    const { data, error } = await supabase.rpc("save_community_open_chat", { p_community_id: (await params).id, p_open_chat_url: openChatUrl });
    if (error) throw error;
    return NextResponse.json({ ok: true, registered: true, openChatUrl: data.open_chat_url });
  } catch (error) {
    const status = apiAuthStatus(error) ?? ((error as { code?: string }).code === "42501" ? 403 : 500);
    return NextResponse.json({ message: status === 403 ? "이 커뮤니티의 오픈채팅방을 수정할 권한이 없어요." : "오픈채팅방 링크를 저장하지 못했어요." }, { status });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser("community_host");
    const { error } = await supabase.rpc("delete_community_open_chat", { p_community_id: (await params).id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: "오픈채팅방 링크를 삭제하지 못했어요." }, { status });
  }
}
