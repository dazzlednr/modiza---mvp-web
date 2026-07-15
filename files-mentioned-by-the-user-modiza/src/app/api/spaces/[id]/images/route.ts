import { NextResponse } from "next/server";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createSpaceImage, deleteSpaceImage, getMySpaceById, reorderSpaceImages, setThumbnailImage } from "@/repositories/spaceRepository";

const allowed = ["image/jpeg", "image/png", "image/webp"];
function failed(error: unknown, message: string) { const status = apiAuthStatus(error); return NextResponse.json({ message: status ? error instanceof Error ? error.message : "권한이 없어요." : message }, { status: status ?? 500 }); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireApiUser("space_host"); const id = (await params).id; const space = await getMySpaceById(supabase, id);
    if (!space) return NextResponse.json({ message: "공간을 찾을 수 없어요." }, { status: 404 });
    const data = await request.formData(); const files = data.getAll("images").filter((item) => item instanceof File) as File[];
    if (space.images.length + files.length > 8) return NextResponse.json({ message: "최대 8장까지 업로드할 수 있어요." }, { status: 400 });
    const created = [];
    for (const file of files) {
      if (!allowed.includes(file.type)) return NextResponse.json({ message: "지원하지 않는 이미지 형식이에요." }, { status: 400 });
      if (file.size > 5_242_880) return NextResponse.json({ message: "이미지 크기는 5MB 이하여야 해요." }, { status: 400 });
      const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "webp"; const path = `${user.id}/${id}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("space-images").upload(path, file, { contentType: file.type }); if (upload.error) throw upload.error;
      const url = supabase.storage.from("space-images").getPublicUrl(path).data.publicUrl;
      created.push(await createSpaceImage(supabase, { spaceId: id, storagePath: path, publicUrl: url, fileName: file.name, mimeType: file.type, fileSize: file.size, sortOrder: space.images.length + created.length, isThumbnail: !space.images.length && !created.length }));
    }
    if (!space.images.length && created[0]) await setThumbnailImage(supabase, id, created[0].id, created[0].publicUrl);
    return NextResponse.json(created);
  } catch (error) { return failed(error, "이미지를 업로드하지 못했어요."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { supabase } = await requireApiUser("space_host"); const id = (await params).id; if (!await getMySpaceById(supabase, id)) return NextResponse.json({ message: "공간을 찾을 수 없어요." }, { status: 404 }); const body = await request.json() as { action: "thumbnail" | "reorder"; imageId?: string; ids?: string[]; url?: string }; if (body.action === "thumbnail" && body.imageId && body.url) await setThumbnailImage(supabase, id, body.imageId, body.url); else if (body.action === "reorder" && body.ids) await reorderSpaceImages(supabase, body.ids); else return NextResponse.json({ message: "이미지 설정을 확인해 주세요." }, { status: 400 }); return NextResponse.json({ ok: true }); } catch (error) { return failed(error, "이미지 설정을 변경하지 못했어요."); } }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { supabase } = await requireApiUser("space_host"); if (!await getMySpaceById(supabase, (await params).id)) return NextResponse.json({ message: "공간을 찾을 수 없어요." }, { status: 404 }); const imageId = new URL(request.url).searchParams.get("imageId"); if (!imageId) return NextResponse.json({ message: "이미지를 확인해 주세요." }, { status: 400 }); const { data, error } = await supabase.from("space_images").select("storage_path").eq("id", imageId).maybeSingle(); if (error) throw error; if (!data) return NextResponse.json({ message: "이미지를 찾을 수 없어요." }, { status: 404 }); const removal = await supabase.storage.from("space-images").remove([data.storage_path]); if (removal.error) throw removal.error; await deleteSpaceImage(supabase, imageId); return NextResponse.json({ ok: true }); } catch (error) { return failed(error, "이미지를 삭제하지 못했어요."); } }
