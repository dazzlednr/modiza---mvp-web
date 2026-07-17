import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { addUserRole } from "@/repositories/profileRepository";

const roleRequestSchema = z.object({
  role: z.literal("community_host"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "요청을 확인해 주세요." }, { status: 400 });
  }

  const parsed = roleRequestSchema.safeParse(body);
  if (!parsed.success) {
    // This also rejects member/admin escalation attempts before any DB call.
    return NextResponse.json({ message: "추가할 수 없는 역할이에요." }, { status: 400 });
  }

  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const profile = await addUserRole(supabase, parsed.data.role);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[MODIZA][roles] activation failed", {
      userId: user.id,
      requestedRole: parsed.data.role,
      error,
    });
    return NextResponse.json(
      { message: "운영자 설정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
