import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { getCommunityHostProfile,startCommunityHost,updateCommunityHostProfile } from "@/repositories/communityHostProfileRepository";

const schema=z.object({headline:z.string().trim().min(2).max(120),introduction:z.string().trim().min(10).max(1000),activityRegion:z.string().trim().max(80).optional().default(""),interestCategories:z.array(z.string()).max(8).default([]),operatingStyles:z.array(z.string()).max(9).default([])});
const parseArray=(form:FormData,key:string)=>JSON.parse(String(form.get(key)??"[]"));

export async function GET(){try{const {supabase,user}=await requireApiUser();return NextResponse.json(await getCommunityHostProfile(supabase,user.id));}catch(error){return NextResponse.json({message:"운영자 프로필을 불러오지 못했어요."},{status:apiAuthStatus(error)??500});}}

async function save(request:Request,editing:boolean){
  try{
    const {supabase,user,profile}=await requireApiUser();
    if(profile?.communityHostRevokedAt)return NextResponse.json({message:"관리자에 의해 커뮤니티 운영 권한이 회수된 계정입니다."},{status:403});
    const form=await request.formData();
    const parsed=schema.safeParse({headline:form.get("headline"),introduction:form.get("introduction"),activityRegion:form.get("activityRegion")??"",interestCategories:parseArray(form,"interestCategories"),operatingStyles:parseArray(form,"operatingStyles")});
    if(!parsed.success)return NextResponse.json({message:"한 줄 소개와 운영자 소개를 확인해 주세요."},{status:400});
    const current=await getCommunityHostProfile(supabase,user.id);
    return NextResponse.json(editing&&current?await updateCommunityHostProfile(supabase,user.id,parsed.data):await startCommunityHost(supabase,parsed.data));
  }catch(error){console.error("[MODIZA][community-host-profile] save failed",error);return NextResponse.json({message:"운영자 프로필을 저장하지 못했어요."},{status:apiAuthStatus(error)??500});}
}
export async function POST(request:Request){return save(request,false);}
export async function PUT(request:Request){return save(request,true);}
