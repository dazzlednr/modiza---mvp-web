import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { updateProfile } from "@/repositories/profileRepository";
import { communityCategories, PRIMARY_REGION, subRegions } from "@/constants/taxonomy";
import { personalizationCategories, personalizationRegions } from "@/constants/personalization";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const parseArray = (form: FormData, name: string) => {
  const value = JSON.parse(String(form.get(name) ?? "[]"));
  if (!Array.isArray(value)) throw new Error("INVALID_ARRAY");
  return value.map(String);
};

export async function GET() {
  try {
    const { profile } = await requireApiUser();
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ message: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, { status: apiAuthStatus(error) ?? 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user, profile } = await requireApiUser();
    if (!profile) return NextResponse.json({ message: "\uD504\uB85C\uD544 \uC815\uBCF4\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694." }, { status: 404 });
    const form = await request.formData();
    const nickname = String(form.get("nickname") ?? "").trim();
    const bio = String(form.get("bio") ?? "").trim();
    const submittedMainRegion = String(form.get("mainRegion") ?? PRIMARY_REGION);
    const mainRegion = submittedMainRegion === "대구 전체" ? PRIMARY_REGION : submittedMainRegion;
    const detailedRegion = String(form.get("detailedRegion") ?? "");
    const customRegion = detailedRegion === "\uAE30\uD0C0" ? String(form.get("customRegion") ?? "").trim() : "";
    const interestCategories = parseArray(form, "interestCategories");
    const interestedCategories = parseArray(form, "interestedCategories");
    const interestedRegions = parseArray(form, "interestedRegions");

    if (!nickname || nickname.length > 40) return NextResponse.json({ message: "\uB2C9\uB124\uC784\uC744 1~40\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    if (bio.length > 300) return NextResponse.json({ message: "\uC18C\uAC1C\uB97C 300\uC790 \uC774\uD558\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    if (mainRegion !== PRIMARY_REGION || !subRegions.includes(detailedRegion as never)) return NextResponse.json({ message: "\uAC70\uC8FC \uC9C0\uC5ED\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    if (!interestCategories.length || interestCategories.some((value) => !communityCategories.includes(value as never))) return NextResponse.json({ message: "\uAD00\uC2EC \uCE74\uD14C\uACE0\uB9AC\uB97C 1\uAC1C \uC774\uC0C1 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    if (interestedCategories.length > 5 || interestedCategories.some((value) => !personalizationCategories.includes(value as never))) return NextResponse.json({ message: "\uAD00\uC2EC \uD65C\uB3D9\uC740 5\uAC1C\uAE4C\uC9C0 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
    if (interestedRegions.length > 3 || interestedRegions.some((value) => !personalizationRegions.includes(value as never))) return NextResponse.json({ message: "\uAD00\uC2EC \uC9C0\uC5ED\uC740 3\uAC1C\uAE4C\uC9C0 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." }, { status: 400 });

    let profileImage = profile.profileImage;
    const uploadedImage = form.get("profileImage");
    if (uploadedImage instanceof File && uploadedImage.size) {
      if (!allowedTypes.includes(uploadedImage.type) || uploadedImage.size > 5 * 1024 * 1024) return NextResponse.json({ message: "JPG, PNG, WebP 5MB \uC774\uD558 \uC774\uBBF8\uC9C0\uB9CC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." }, { status: 400 });
      const extension = uploadedImage.type === "image/png" ? "png" : uploadedImage.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("profile-images").upload(path, uploadedImage, { contentType: uploadedImage.type, upsert: false });
      if (upload.error) throw upload.error;
      profileImage = supabase.storage.from("profile-images").getPublicUrl(path).data.publicUrl;
      const previousPath = profile.profileImage?.split("/storage/v1/object/public/profile-images/")[1];
      if (previousPath) await supabase.storage.from("profile-images").remove([decodeURIComponent(previousPath)]);
    }
    return NextResponse.json(await updateProfile(supabase, user.id, { nickname, bio: bio || null, profileImage, mainRegion, detailedRegion, customRegion: customRegion || null, interestCategories, interestedCategories, interestedRegions }));
  } catch (error) {
    const status = apiAuthStatus(error) ?? 500;
    console.error("[MODIZA][profile] update failed", error);
    return NextResponse.json({ message: "\uD504\uB85C\uD544\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694." }, { status });
  }
}
