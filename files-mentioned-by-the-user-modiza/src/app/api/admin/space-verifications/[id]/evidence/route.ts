import {NextResponse} from "next/server";
import {requireApiAdmin} from "@/lib/auth/api";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const{id}=await params;const fileId=new URL(request.url).searchParams.get("fileId");
    if(!fileId)return NextResponse.json({message:"파일을 확인해 주세요."},{status:400});
    const{admin}=await requireApiAdmin();
    const{data,error}=await admin.from("space_verification_files").select("storage_path,request_id").eq("id",fileId).eq("request_id",id).single();
    if(error||!data)return NextResponse.json({message:"파일을 찾을 수 없어요."},{status:404});
    const signed=await admin.storage.from("space-verification-evidence").createSignedUrl(data.storage_path,60);
    if(signed.error)throw signed.error;
    return NextResponse.redirect(signed.data.signedUrl);
  }catch(error){console.error("[MODIZA][admin] verification evidence failed",error);return NextResponse.json({message:"증빙자료를 열지 못했어요."},{status:500});}
}
