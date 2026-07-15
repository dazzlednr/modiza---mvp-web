import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createSpace, createSpaceImage, getSpacesForDashboard, setThumbnailImage } from "@/repositories/spaceRepository";
import type { CreateSpaceInput, SpaceStatus } from "@/types/space";

const allowed = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 5 * 1024 * 1024;
function validate(value: CreateSpaceInput, status: SpaceStatus, files: File[]) { if (!value.name?.trim()) return "공간명을 입력해 주세요."; if (status === "draft") return null; if (!value.spaceType || !value.shortDescription || !value.description || !value.mainRegion || !value.detailedRegion || !value.address) return "필수 공간 정보를 모두 입력해 주세요."; if (value.detailedRegion === "기타" && !value.customRegion?.trim()) return "기타 지역명을 입력해 주세요."; if (value.pricePerHour < 0 || value.minimumHours < 1 || value.maxCapacity < 1 || !value.availableDays?.length) return "가격, 이용 시간, 인원, 이용 가능 요일을 확인해 주세요."; if (value.suitableCapacity && value.suitableCapacity > value.maxCapacity) return "적정 인원은 최대 인원 이하여야 해요."; if (value.availableEndTime && value.availableStartTime && value.availableEndTime <= value.availableStartTime) return "종료 시간은 시작 시간보다 늦어야 해요."; if (!files.length) return "대표 이미지를 한 장 이상 등록해 주세요."; return null; }
function fileName(name: string) { const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp"; return `${crypto.randomUUID()}.${extension}`; }

export async function GET() { try { const { supabase } = await requireApiUser("space_host"); return NextResponse.json(await getSpacesForDashboard(supabase)); } catch (error) { const status = apiAuthStatus(error) ?? 500; return NextResponse.json({ message: status === 500 ? "공간 목록을 불러오지 못했어요." : error instanceof Error ? error.message : "권한이 없어요." }, { status }); } }

export async function POST(request: Request) {
  let db: SupabaseClient | null = null;
  let createdId: string | undefined;
  const uploaded: string[] = [];
  try {
    const context = await requireApiUser("space_host"); db = context.supabase;
    const form = await request.formData();
    const values = JSON.parse(String(form.get("values"))) as CreateSpaceInput;
    const status = String(form.get("status")) as SpaceStatus;
    const files = form.getAll("images").filter((item) => item instanceof File) as File[];
    if (files.length > 8) return NextResponse.json({ message: "최대 8장까지 업로드할 수 있어요." }, { status: 400 });
    for (const file of files) { if (!allowed.includes(file.type)) return NextResponse.json({ message: "지원하지 않는 이미지 형식이에요." }, { status: 400 }); if (file.size > maxSize) return NextResponse.json({ message: "이미지 크기는 5MB 이하여야 해요." }, { status: 400 }); }
    const problem = validate(values, status, files); if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    const space = await createSpace(db, { ...values, status: "draft" }); createdId = space.id;
    for (let index = 0; index < files.length; index++) {
      const file = files[index]; const path = `${context.user.id}/${space.id}/${fileName(file.name)}`;
      const upload = await db.storage.from("space-images").upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error(upload.error.message.includes("Bucket not found") ? "BUCKET_MISSING" : "UPLOAD_FAILED");
      uploaded.push(path); const url = db.storage.from("space-images").getPublicUrl(path).data.publicUrl;
      const record = await createSpaceImage(db, { spaceId: space.id, storagePath: path, publicUrl: url, fileName: file.name, mimeType: file.type, fileSize: file.size, sortOrder: index, isThumbnail: index === 0 });
      if (index === 0) await setThumbnailImage(db, space.id, record.id, url);
    }
    const update = await db.from("spaces").update({ status }).eq("id", space.id).eq("owner_id", context.user.id); if (update.error) throw update.error;
    const saved = await db.from("spaces").select("slug,name,status,thumbnail_url").eq("id", space.id).single(); if (saved.error) throw saved.error;
    return NextResponse.json(saved.data, { status: 201 });
  } catch (error) {
    const authStatus = apiAuthStatus(error); if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    if (uploaded.length && db) await db.storage.from("space-images").remove(uploaded);
    if (createdId && db) await db.from("spaces").delete().eq("id", createdId);
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: code === "BUCKET_MISSING" ? "이미지 저장소가 준비되지 않았어요. 관리자에게 문의해 주세요." : "공간 정보를 저장하지 못했어요." }, { status: 500 });
  }
}
