import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { updateProfile } from "@/repositories/profileRepository";
import { communityCategories, PRIMARY_REGION, subRegions } from "@/constants/taxonomy";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

export async function PUT(request: Request) {
  try {
    const { supabase, user, profile } = await requireApiUser();
    if (!profile) return NextResponse.json({ message: "프로필 정보를 찾지 못했어요." }, { status: 404 });

    const form = await request.formData();
    const nickname = String(form.get("nickname") ?? "").trim();
    const bio = String(form.get("bio") ?? "").trim();
    const mainRegion = String(form.get("mainRegion") ?? PRIMARY_REGION);
    const detailedRegion = String(form.get("detailedRegion") ?? "");
    const customRegion = detailedRegion === "기타" ? String(form.get("customRegion") ?? "").trim() : "";
    let interestCategories: string[] = [];
    try { interestCategories = JSON.parse(String(form.get("interestCategories") ?? "[]")); } catch { return NextResponse.json({ message: "관심 카테고리를 확인해 주세요." }, { status: 400 }); }
    if (!nickname || nickname.length > 40) return NextResponse.json({ message: "닉네임은 1~40자로 입력해 주세요." }, { status: 400 });
    if (bio.length > 300) return NextResponse.json({ message: "소개는 300자 이하로 입력해 주세요." }, { status: 400 });
    if (mainRegion !== PRIMARY_REGION || !subRegions.includes(detailedRegion as never)) return NextResponse.json({ message: "거주 지역을 선택해 주세요." }, { status: 400 });
    if (detailedRegion === "기타" && !customRegion) return NextResponse.json({ message: "기타 지역명을 입력해 주세요." }, { status: 400 });
    if (!interestCategories.length || interestCategories.some((value) => !communityCategories.includes(value as never))) return NextResponse.json({ message: "관심 카테고리를 1개 이상 선택해 주세요." }, { status: 400 });

    let profileImage = profile.profileImage;
    const uploadedImage = form.get("profileImage");
    if (uploadedImage instanceof File && uploadedImage.size) {
      if (!allowedTypes.includes(uploadedImage.type) || uploadedImage.size > 5 * 1024 * 1024) {
        return NextResponse.json({ message: "JPG, PNG, WebP 형식의 5MB 이하 이미지를 선택해 주세요." }, { status: 400 });
      }
      const extension = uploadedImage.type === "image/png" ? "png" : uploadedImage.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("profile-images").upload(path, uploadedImage, { contentType: uploadedImage.type, upsert: false });
      if (upload.error) throw upload.error;
      profileImage = supabase.storage.from("profile-images").getPublicUrl(path).data.publicUrl;
      const previousPath = profile.profileImage?.split("/storage/v1/object/public/profile-images/")[1];
      if (previousPath) await supabase.storage.from("profile-images").remove([decodeURIComponent(previousPath)]);
    }

    return NextResponse.json(await updateProfile(supabase, user.id, { nickname, bio: bio || null, profileImage, mainRegion, detailedRegion, customRegion: customRegion || null, interestCategories }));
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    console.error("[MODIZA][profile] update failed", error);
    return NextResponse.json({ message: status === 500 ? "프로필을 저장하지 못했어요." : error instanceof Error ? error.message : "로그인이 필요해요." }, { status });
  }
}
