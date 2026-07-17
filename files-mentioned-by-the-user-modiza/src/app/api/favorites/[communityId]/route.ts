import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { addFavorite, removeFavorite } from "@/repositories/favoriteRepository";

const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(_: Request, { params }: { params: Promise<{ communityId: string }> }) {
  try {
    const id = (await params).communityId;
    if (!validId(id)) return NextResponse.json({ message: "\uCEE4\uBBA4\uB2C8\uD2F0\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    const { supabase } = await requireApiUser();
    await addFavorite(supabase, id);
    return NextResponse.json({ favorite: true });
  } catch (error) {
    return NextResponse.json({ message: "\uAD00\uC2EC \uCEE4\uBBA4\uB2C8\uD2F0\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694." }, { status: apiAuthStatus(error) ?? 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ communityId: string }> }) {
  try {
    const id = (await params).communityId;
    if (!validId(id)) return NextResponse.json({ message: "\uCEE4\uBBA4\uB2C8\uD2F0\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    const { supabase } = await requireApiUser();
    await removeFavorite(supabase, id);
    return NextResponse.json({ favorite: false });
  } catch (error) {
    return NextResponse.json({ message: "\uAD00\uC2EC \uCEE4\uBBA4\uB2C8\uD2F0\uB97C \uD574\uC81C\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694." }, { status: apiAuthStatus(error) ?? 500 });
  }
}
