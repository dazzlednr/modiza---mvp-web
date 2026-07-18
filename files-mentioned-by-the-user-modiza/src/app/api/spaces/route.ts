import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSpace, createSpaceImage, getSpacesForDashboard, setThumbnailImage } from "@/repositories/spaceRepository";
import type { CreateSpaceInput, SpaceRelationshipType } from "@/types/space";

const allowed = ["image/jpeg", "image/png", "image/webp"];
const evidenceAllowed = ["application/pdf", "image/jpeg", "image/png"];
const maxSize = 10 * 1024 * 1024;
type VerificationInput={contactName:string;contactPhone:string;relationshipType:SpaceRelationshipType;relationshipDetail?:string;applicantNote?:string;idempotencyKey:string};
function validate(value: CreateSpaceInput, intent: "draft"|"pending", files: File[], verification?:VerificationInput) {
  if ((value.name?.trim().length ?? 0) < 2) return "공간명은 2자 이상 입력해 주세요.";
  if (intent === "draft") return null;
  if (!value.preferredContactMethod || !value.privateContact?.trim()) return "협의 연락 방법과 연락 정보를 입력해 주세요.";
  if (value.preferredContactMethod === "store_phone" && /^(\+?82[-\s]?)?0?1[016789][-\s]?/i.test(value.privateContact.replace(/[()]/g, ""))) return "개인 휴대전화번호가 아닌 매장 대표 전화번호를 입력해 주세요.";
  if (!value.roadAddress?.trim() || value.address.trim() !== value.roadAddress.trim()) return "주소 검색을 통해 도로명 주소를 선택해주세요.";
  if (!value.spaceType) return "공간 유형을 선택해 주세요.";
  if ((value.shortDescription?.trim().length ?? 0) < 5) return "한 줄 소개는 5자 이상 입력해 주세요.";
  if ((value.description?.trim().length ?? 0) < 10) return "상세 소개는 10자 이상 입력해 주세요.";
  if (!value.mainRegion || !value.detailedRegion || !value.address) return "주소와 지역 정보를 확인해 주세요.";
  if (value.detailedRegion === "기타" && !value.customRegion?.trim()) return "기타 지역명을 입력해 주세요.";
  if (value.pricePerHour < 0 || value.minimumHours < 1 || value.minCapacity < 1 || value.maxCapacity < 1 || !value.operatingHours?.some((hour) => hour.isOpen)) return "가격, 이용 시간, 인원, 운영 요일을 확인해 주세요.";
  if (value.minCapacity > value.maxCapacity) return "최소 인원은 최대 인원보다 클 수 없어요.";
  if (value.suitableCapacity && (value.suitableCapacity < value.minCapacity || value.suitableCapacity > value.maxCapacity)) return "적정 인원은 최소·최대 인원 범위 안이어야 해요.";
  if ((value.usageRules?.trim().length ?? 0) < 5) return "이용 규칙은 5자 이상 입력해 주세요.";
  if (!files.length) return "대표 이미지를 한 장 이상 등록해 주세요.";
  if (!verification?.contactName?.trim() || !verification.contactPhone?.trim() || !verification.relationshipType) return "담당자 연락처와 공간과의 관계를 입력해 주세요.";
  if (verification.relationshipType === "other" && !verification.relationshipDetail?.trim()) return "공간과의 관계를 직접 입력해 주세요.";
  return null;
}
function fileName(name: string) { const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp"; return `${crypto.randomUUID()}.${extension}`; }

export async function GET() { try { const { supabase } = await requireApiUser("space_host"); return NextResponse.json(await getSpacesForDashboard(supabase)); } catch (error) { const status = apiAuthStatus(error) ?? 500; return NextResponse.json({ message: status === 500 ? "공간 목록을 불러오지 못했어요." : error instanceof Error ? error.message : "권한이 없어요." }, { status }); } }

export async function POST(request: Request) {
  let db: SupabaseClient | null = null;
  const evidenceStorage = createAdminSupabaseClient();
  let createdId: string | undefined;
  let stage = "authorization";
  const uploaded: string[] = [];
  const uploadedEvidence: string[] = [];
  try {
    const context = await requireApiUser("space_host"); db = context.supabase; stage = "request parsing";
    const form = await request.formData();
    const values = JSON.parse(String(form.get("values"))) as CreateSpaceInput;
    const intent = String(form.get("intent")||form.get("status")) as "draft"|"pending";
    if(!["draft","pending"].includes(intent))return NextResponse.json({message:"저장 방식을 확인해 주세요."},{status:400});
    const verification = form.get("verification") ? JSON.parse(String(form.get("verification"))) as VerificationInput : undefined;
    const files = form.getAll("images").filter((item) => item instanceof File) as File[];
    const evidenceFiles = form.getAll("evidence").filter((item)=>item instanceof File) as File[];
    if (files.length > 10) return NextResponse.json({ message: "사진은 최대 10장까지 등록할 수 있어요." }, { status: 400 });
    for (const file of files) { if (!allowed.includes(file.type)) return NextResponse.json({ message: "JPG, PNG 또는 WEBP 형식의 사진을 올려주세요." }, { status: 400 }); if (file.size > maxSize) return NextResponse.json({ message: "사진 한 장의 용량은 최대 10MB까지 가능합니다." }, { status: 400 }); }
    if(intent==="pending"&&(evidenceFiles.length<1||evidenceFiles.length>3))return NextResponse.json({message:"공간 운영 권한 증빙자료를 1개 이상 3개 이하로 첨부해 주세요."},{status:400});
    for(const file of evidenceFiles){if(!evidenceAllowed.includes(file.type))return NextResponse.json({message:"증빙자료는 PDF, JPG, JPEG, PNG 파일만 첨부할 수 있어요."},{status:400});if(file.size>maxSize)return NextResponse.json({message:"증빙자료는 파일당 최대 10MB까지 첨부할 수 있어요."},{status:400});}
    const problem = validate(values, intent, files,verification); if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    if(intent==="pending"&&verification?.idempotencyKey){const existing=await db.from("space_verification_requests").select("space_id").eq("idempotency_key",verification.idempotencyKey).maybeSingle();if(existing.error)throw existing.error;if(existing.data){const prior=await db.from("spaces").select("slug,name,status,thumbnail_url").eq("id",existing.data.space_id).single();if(prior.error)throw prior.error;return NextResponse.json(prior.data);}}
    stage = "space row creation";
    const space = await createSpace(db, { ...values, status: "draft" }); createdId = space.id;
    for (let index = 0; index < files.length; index++) {
      stage = `storage upload ${index + 1}`;
      const file = files[index]; const path = `${context.user.id}/${space.id}/${fileName(file.name)}`;
      const upload = await db.storage.from("space-images").upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error(upload.error.message.includes("Bucket not found") ? "BUCKET_MISSING" : "UPLOAD_FAILED");
      uploaded.push(path); const url = db.storage.from("space-images").getPublicUrl(path).data.publicUrl; stage = `image metadata ${index + 1}`;
      const record = await createSpaceImage(db, { spaceId: space.id, storagePath: path, publicUrl: url, fileName: file.name, mimeType: file.type, fileSize: file.size, sortOrder: index, isThumbnail: index === 0 });
      if (index === 0) await setThumbnailImage(db, space.id, record.id, url);
    }
    if(intent==="pending"&&verification){
      const metadata:{clientFileId:string;storagePath:string;originalName:string;mimeType:string;fileSize:number}[]=[];
      for(let index=0;index<evidenceFiles.length;index++){
        const file=evidenceFiles[index];const clientFileId=crypto.randomUUID();const path=`${context.user.id}/${space.id}/${verification.idempotencyKey}/${clientFileId}-${fileName(file.name)}`;
        stage=`evidence upload ${index+1}`;const upload=await evidenceStorage.storage.from("space-verification-evidence").upload(path,file,{contentType:file.type,upsert:false});
        if(upload.error){
          console.error("[MODIZA][space-registration] evidence upload failed", { index:index+1, code:upload.error.name, message:upload.error.message, statusCode:upload.error.statusCode, mimeType:file.type, fileSize:file.size });
          throw new Error(upload.error.message.includes("Bucket not found")?"EVIDENCE_BUCKET_MISSING":`EVIDENCE_UPLOAD_FAILED: ${upload.error.message}`);
        }
        uploadedEvidence.push(path);metadata.push({clientFileId,storagePath:path,originalName:file.name,mimeType:file.type,fileSize:file.size});
      }
      stage="verification submission";
      const submission=await db.rpc("submit_space_verification",{p_space_id:space.id,p_contact_name:verification.contactName,p_contact_phone:verification.contactPhone,p_relationship_type:verification.relationshipType,p_relationship_detail:verification.relationshipDetail||null,p_applicant_note:verification.applicantNote||null,p_evidence:metadata,p_idempotency_key:verification.idempotencyKey});
      if(submission.error)throw submission.error;
    }
    const saved = await db.from("spaces").select("slug,name,status,thumbnail_url").eq("id", space.id).single(); if (saved.error) throw saved.error;
    return NextResponse.json(saved.data, { status: 201 });
  } catch (error) {
    const authStatus = apiAuthStatus(error); if (authStatus) return NextResponse.json({ message: error instanceof Error ? error.message : "권한이 없어요." }, { status: authStatus });
    if (uploaded.length && db) await db.storage.from("space-images").remove(uploaded);
    if (uploadedEvidence.length) await evidenceStorage.storage.from("space-verification-evidence").remove(uploadedEvidence);
    if (createdId && db) await db.from("spaces").delete().eq("id", createdId);
    const detail = error as { code?:string; message?:string; details?:string; hint?:string };
    console.error("[MODIZA][space-registration] failed", { stage, code:detail?.code, message:detail?.message??String(error), details:detail?.details, hint:detail?.hint, createdId, uploadedCount:uploaded.length });
    const code = error instanceof Error ? error.message : "";
    if(detail?.message==="SPACE_HOST_QUALIFICATION_REQUIRED"){
      return NextResponse.json({message:"공간 운영자 자격 승인이 필요해요. 관리자 계정이라면 최신 DB 보정 Migration을 적용해 주세요."},{status:403});
    }
    const debug = process.env.NODE_ENV === "development" ? ` [${stage}] [${detail?.code ?? "UNKNOWN"}] ${detail?.message ?? String(error)}` : "";
    return NextResponse.json({ message: code === "BUCKET_MISSING"||code==="EVIDENCE_BUCKET_MISSING" ? "파일 저장소가 준비되지 않았어요. 관리자에게 문의해 주세요." : `공간 정보를 저장하지 못했어요.${debug}` }, { status: 500 });
  }
}
