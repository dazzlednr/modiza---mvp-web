import {NextResponse} from "next/server";
import {apiAuthStatus,requireApiUser} from "@/lib/auth/api";
import {createAdminSupabaseClient} from "@/lib/supabase/admin";
import {getMySpaceById} from "@/repositories/spaceRepository";
import type {SpaceRelationshipType} from "@/types/space";

const allowed=["application/pdf","image/jpeg","image/png"];
const maxSize=10*1024*1024;
function safeName(name:string){const extension=name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";return `${crypto.randomUUID()}.${extension}`;}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const uploaded:string[]=[];
  const evidenceStorage=createAdminSupabaseClient();
  try{
    const{id}=await params;
    const{supabase,user}=await requireApiUser("space_host");
    const space=await getMySpaceById(supabase,id);
    if(!space)return NextResponse.json({message:"공간을 찾을 수 없어요."},{status:404});
    const form=await request.formData();
    const input=JSON.parse(String(form.get("verification")||"{}")) as {contactName?:string;contactPhone?:string;relationshipType?:SpaceRelationshipType;relationshipDetail?:string;applicantNote?:string;idempotencyKey?:string};
    const files=form.getAll("evidence").filter((item)=>item instanceof File) as File[];
    if(!input.contactName?.trim()||!input.contactPhone?.trim()||!input.relationshipType||!input.idempotencyKey)return NextResponse.json({message:"담당자와 인증 정보를 모두 입력해 주세요."},{status:400});
    if(input.relationshipType==="other"&&!input.relationshipDetail?.trim())return NextResponse.json({message:"공간과의 관계를 직접 입력해 주세요."},{status:400});
    const existing=await supabase.from("space_verification_requests").select("id,space_id,status").eq("idempotency_key",input.idempotencyKey).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data)return NextResponse.json({ok:true,status:existing.data.status});
    if(files.length<1||files.length>3)return NextResponse.json({message:"증빙자료를 1개 이상 3개 이하로 첨부해 주세요."},{status:400});
    for(const file of files){if(!allowed.includes(file.type))return NextResponse.json({message:"증빙자료는 PDF, JPG, JPEG, PNG 파일만 첨부할 수 있어요."},{status:400});if(file.size>maxSize)return NextResponse.json({message:"증빙자료는 파일당 최대 10MB까지 첨부할 수 있어요."},{status:400});}
    const metadata=[];
    for(const file of files){
      const clientFileId=crypto.randomUUID();
      const path=`${user.id}/${space.id}/${input.idempotencyKey}/${clientFileId}-${safeName(file.name)}`;
      const result=await evidenceStorage.storage.from("space-verification-evidence").upload(path,file,{contentType:file.type,upsert:false});
      if(result.error){
        console.error("[MODIZA][space-verification] evidence upload failed",{code:result.error.name,message:result.error.message,statusCode:result.error.statusCode,mimeType:file.type,fileSize:file.size});
        throw new Error(`EVIDENCE_UPLOAD_FAILED: ${result.error.message}`);
      }
      uploaded.push(path);
      metadata.push({clientFileId,storagePath:path,originalName:file.name,mimeType:file.type,fileSize:file.size});
    }
    const result=await supabase.rpc("submit_space_verification",{p_space_id:space.id,p_contact_name:input.contactName,p_contact_phone:input.contactPhone,p_relationship_type:input.relationshipType,p_relationship_detail:input.relationshipDetail||null,p_applicant_note:input.applicantNote||null,p_evidence:metadata,p_idempotency_key:input.idempotencyKey});
    if(result.error)throw result.error;
    return NextResponse.json({ok:true,status:"pending"});
  }catch(error){
    const status=apiAuthStatus(error);
    try{if(uploaded.length)await evidenceStorage.storage.from("space-verification-evidence").remove(uploaded);}catch{}
    console.error("[MODIZA][space-verification] submission failed",error);
    if((error as {message?:string})?.message==="SPACE_HOST_QUALIFICATION_REQUIRED"){
      return NextResponse.json({message:"공간 운영자 자격 승인이 필요해요. 관리자 계정이라면 최신 DB 보정 Migration을 적용해 주세요."},{status:403});
    }
    return NextResponse.json({message:status?error instanceof Error?error.message:"권한이 없어요.":"공간 인증 신청을 저장하지 못했어요."},{status:status??500});
  }
}
