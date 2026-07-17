import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { cancelMyApplication, getMyApplicationById } from "@/repositories/applicationRepository";
import { getSpaceById } from "@/repositories/spaceRepository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireApiUser();
    const application = await getMyApplicationById(supabase, (await params).id);
    if (!application) return NextResponse.json({ message: "신청 내역을 찾을 수 없어요." }, { status: 404 });
    let openChatUrl: string | null = null;
    let meetingPlace: { name: string; address: string; addressDetail: string | null } | null = null;
    if (application.status === "approved") {
      const { data, error } = await supabase.from("community_open_chats").select("open_chat_url").eq("community_id", application.communityId).maybeSingle();
      if (error) throw error;
      openChatUrl = data?.open_chat_url ?? null;
      const community = await supabase.from("communities").select("linked_space_id").eq("id", application.communityId).maybeSingle();
      if (community.error) throw community.error;
      if (community.data?.linked_space_id) {
        const space = await getSpaceById(supabase, community.data.linked_space_id);
        if (space) meetingPlace = { name: space.name, address: space.address, addressDetail: space.addressDetail ?? null };
      }
    }
    const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle();
    return NextResponse.json({ ...application, entryNickname: profile?.nickname ?? application.applicantName, openChatUrl, meetingPlace });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    return NextResponse.json({ message: status === 401 ? "로그인이 필요해요." : "신청 내역을 불러오지 못했어요." }, { status });
  }
}

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiUser();
    await cancelMyApplication(supabase, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = apiAuthStatus(error) ?? 400;
    return NextResponse.json({ message: status === 400 ? "검토 중인 신청만 취소할 수 있어요." : "로그인이 필요해요." }, { status });
  }
}
