import { NextResponse } from "next/server";
import { requireApiUser, apiAuthStatus } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyLatestHostApplication } from "@/repositories/adminRepository";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function GET() {
  try {
    const { user } = await requireApiUser();
    return NextResponse.json(await getMyLatestHostApplication(createAdminSupabaseClient(), user.id));
  } catch (error) {
    return NextResponse.json({ message: "신청 정보를 불러오지 못했어요." }, { status: apiAuthStatus(error) ?? 500 });
  }
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  try {
    const { user, profile } = await requireApiUser();
    if (profile?.roles.includes("space_host") || profile?.roles.includes("admin")) {
      return NextResponse.json({ message: "이미 공간 등록 권한이 있어요." }, { status: 409 });
    }

    const form = await request.formData();
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const contactMethod = value("negotiationContactMethod");
    const contactValue = value("negotiationContactValue");
    const contactMethods = new Set(["store_phone", "kakao_open_chat", "kakao_channel", "instagram", "other"]);
    const evidenceFiles = form.getAll("evidence").filter((item): item is File => item instanceof File && item.size > 0);
    if (!value("applicantName") || !value("spaceName") || !value("spaceAddress") || !value("spaceType") || !value("relationship") || !contactMethods.has(contactMethod) || !contactValue) {
      return NextResponse.json({ message: "필수 정보를 모두 입력해 주세요." }, { status: 400 });
    }
    if (contactMethod === "store_phone" && !/^[0-9()\-+\s]{8,30}$/.test(contactValue)) return NextResponse.json({ message: "매장 전화번호 형식을 확인해 주세요." }, { status: 400 });
    if (contactMethod === "store_phone" && /^(\+?82[-\s]?)?0?1[016789][-\s]?/i.test(contactValue.replace(/[()]/g, ""))) return NextResponse.json({ message: "개인 휴대전화번호 대신 매장 대표 전화번호를 입력해 주세요." }, { status: 400 });
    if (contactMethod === "kakao_open_chat" && !/^https:\/\/open\.kakao\.com\//i.test(contactValue)) return NextResponse.json({ message: "카카오톡 오픈채팅 링크를 확인해 주세요." }, { status: 400 });
    if (["kakao_channel"].includes(contactMethod) && !/^https?:\/\//i.test(contactValue)) return NextResponse.json({ message: "카카오톡 채널 링크를 전체 주소로 입력해 주세요." }, { status: 400 });
    if (!evidenceFiles.length) {
      return NextResponse.json({ message: "공간 운영 권한을 확인할 수 있는 증빙자료를 1개 이상 첨부해 주세요." }, { status: 400 });
    }
    if (evidenceFiles.length > MAX_FILES) {
      return NextResponse.json({ message: "증빙자료는 최대 3개까지 첨부할 수 있어요." }, { status: 400 });
    }
    if (evidenceFiles.some((file) => !allowed.has(file.type))) {
      return NextResponse.json({ message: "PDF, JPG, JPEG, PNG 형식의 파일만 첨부할 수 있어요." }, { status: 400 });
    }
    if (evidenceFiles.some((file) => file.size > MAX_FILE_SIZE)) {
      return NextResponse.json({ message: "각 파일은 10MB 이하로 첨부해 주세요." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const pending = await admin.from("space_host_applications").select("id").eq("user_id", user.id).eq("status", "pending").maybeSingle();
    if (pending.data) return NextResponse.json({ message: "이미 확인 중인 신청이 있어요." }, { status: 409 });

    const mimeTypes: string[] = [];
    for (const evidence of evidenceFiles) {
      const extension = evidence.type === "application/pdf" ? "pdf" : evidence.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const upload = await admin.storage.from("space-host-evidence").upload(path, evidence, { contentType: evidence.type, upsert: false });
      if (upload.error) throw upload.error;
      uploadedPaths.push(path);
      mimeTypes.push(evidence.type);
    }

    const insert = await admin.from("space_host_applications").insert({
      user_id: user.id,
      applicant_name: value("applicantName"),
      email: user.email ?? profile?.email,
      phone: contactValue,
      negotiation_contact_method: contactMethod,
      negotiation_contact_value: contactValue,
      space_name: value("spaceName"),
      space_address: value("spaceAddress"),
      space_type: value("spaceType"),
      relationship: value("relationship"),
      related_link: null,
      message: value("message") || null,
      evidence_path: uploadedPaths[0],
      evidence_mime_type: mimeTypes[0],
      evidence_paths: uploadedPaths,
      evidence_mime_types: mimeTypes,
      status: "pending",
    }).select().single();
    if (insert.error) throw insert.error;

    const roles = (profile?.roles ?? ["member"]).filter((role) => role !== "space_host" && role !== "host_pending");
    const update = await admin.from("profiles").update({ roles: [...roles, "host_pending"] }).eq("id", user.id);
    if (update.error) throw update.error;
    return NextResponse.json(insert.data, { status: 201 });
  } catch (error) {
    if (uploadedPaths.length) await createAdminSupabaseClient().storage.from("space-host-evidence").remove(uploadedPaths);
    console.error("[MODIZA][host-application] submit failed", error);
    return NextResponse.json({ message: "공간 운영자 신청을 저장하지 못했어요." }, { status: apiAuthStatus(error) ?? 500 });
  }
}
