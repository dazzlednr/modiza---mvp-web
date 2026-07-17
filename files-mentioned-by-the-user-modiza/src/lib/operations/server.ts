import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { OPENAI_OPERATION_MAX_OUTPUT_TOKENS,OPENAI_OPERATION_MODEL,OPENAI_OPERATION_TIMEOUT_MS } from "@/config/openai";

const calls=new Map<string,number[]>();
const duplicates=new Map<string,number>();
export const operationAiEnabled=()=>process.env.ENABLE_OPERATION_AI==="true"&&Boolean(process.env.OPENAI_API_KEY);

export function guardOperationCall(userId:string,payload:unknown){
  const now=Date.now();const recent=(calls.get(userId)??[]).filter(time=>now-time<10*60_000);
  if(recent.length>=10)throw new Error("RATE_LIMITED");
  const hash=createHash("sha256").update(userId+JSON.stringify(payload)).digest("hex");
  if(now-(duplicates.get(hash)??0)<10_000)throw new Error("DUPLICATE_REQUEST");
  recent.push(now);calls.set(userId,recent);duplicates.set(hash,now);
}

export async function getOperationContext(db:SupabaseClient,communityId:string,scheduleId?:string|null){
  const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("AUTH_REQUIRED");
  const {data:community,error}=await db.from("communities").select("id,owner_id,name,category,short_description,description,activity_description,mood_tags,capacity,current_members,target_audience,recommended_for,meeting_frequency_label,preparation_items,participation_notices,linked_space_id").eq("id",communityId).eq("owner_id",user.id).maybeSingle();
  if(error)throw error;if(!community)throw new Error("COMMUNITY_FORBIDDEN");
  let schedule=null;
  if(scheduleId){const result=await db.from("schedules").select("id,community_id,title,date,start_time,end_time,location,description").eq("id",scheduleId).eq("community_id",communityId).maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error("SCHEDULE_NOT_FOUND");schedule=result.data;}
  let space=null;
  if(community.linked_space_id){const result=await db.from("spaces").select("name,address,facilities").eq("id",community.linked_space_id).maybeSingle();if(!result.error)space=result.data;}
  return {community:{name:community.name,category:community.category,shortDescription:community.short_description,description:community.description,activity:community.activity_description,moods:community.mood_tags,capacity:community.capacity,confirmedMembers:community.current_members,targetAudience:community.target_audience,recommendedFor:community.recommended_for,frequency:community.meeting_frequency_label,preparationItems:community.preparation_items,participationNotices:community.participation_notices},schedule:schedule?{id:schedule.id,title:schedule.title,date:schedule.date,startTime:schedule.start_time,endTime:schedule.end_time,location:schedule.location,description:schedule.description}:null,space:space?{name:space.name,address:space.address,facilities:space.facilities}:null};
}

export async function parseOperationSuggestion<T extends z.ZodTypeAny>(schema:T,name:string,system:string,input:unknown){
  if(!operationAiEnabled())throw new Error("OPERATION_AI_DISABLED");
  const response=await new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:OPENAI_OPERATION_TIMEOUT_MS,maxRetries:0}).responses.parse({model:OPENAI_OPERATION_MODEL,input:[{role:"system",content:system},{role:"user",content:JSON.stringify(input)}],text:{format:zodTextFormat(schema,name)},max_output_tokens:OPENAI_OPERATION_MAX_OUTPUT_TOKENS});
  if(!response.output_parsed)throw new Error("INVALID_AI_RESPONSE");
  return response.output_parsed as z.infer<T>;
}

export function operationErrorMessage(error:unknown){
  const code=error instanceof Error?error.message:"";
  if(code==="AUTH_REQUIRED")return {status:401,message:"로그인이 만료되었어요. 다시 로그인해주세요."};
  if(code==="COMMUNITY_FORBIDDEN")return {status:403,message:"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."};
  if(code==="SCHEDULE_NOT_FOUND")return {status:400,message:"제안을 위해 필요한 정보를 먼저 입력해주세요."};
  if(code==="RATE_LIMITED"||code==="DUPLICATE_REQUEST"||code==="OPERATION_AI_DISABLED")return {status:429,message:"현재 제안 기능을 잠시 사용할 수 없어요. 직접 작성 기능은 정상적으로 이용할 수 있습니다."};
  return {status:502,message:"모디자가 제안을 준비하지 못했어요. 잠시 후 다시 시도해주세요."};
}
