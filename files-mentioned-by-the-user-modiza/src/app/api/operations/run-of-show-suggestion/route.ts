import { NextResponse } from "next/server";
import { requireApiUser,apiAuthStatus } from "@/lib/auth/api";
import { getOperationContext,guardOperationCall,operationErrorMessage,parseOperationSuggestion } from "@/lib/operations/server";
import { OPERATION_AGENDA_PROMPT } from "@/lib/operations/prompts";
import { AgendaApplySchema,AgendaSuggestionInputSchema,AgendaSuggestionSchema,type AgendaItem } from "@/types/operation-suggestion";

const minutes=(value:string)=>{const [hour,minute]=value.slice(0,5).split(":").map(Number);return hour*60+minute;};
function validateAgenda(items:AgendaItem[],start:string,end:string){const from=minutes(start),to=minutes(end);let previous=from;for(const item of items){const itemStart=minutes(item.startTime),itemEnd=minutes(item.endTime);if(itemStart<from||itemEnd>to||itemStart>=itemEnd||itemStart<previous)throw new Error("INVALID_AGENDA_RANGE");previous=itemEnd;}}

export async function GET(request:Request){
  try{const {supabase}=await requireApiUser("community_host");const url=new URL(request.url),communityId=url.searchParams.get("communityId")??"",scheduleId=url.searchParams.get("scheduleId")??"";if(!communityId||!scheduleId)return NextResponse.json({message:"일정을 확인해주세요."},{status:400});await getOperationContext(supabase,communityId,scheduleId);const {data,error}=await supabase.from("schedule_agenda_items").select("start_time,end_time,title,description").eq("schedule_id",scheduleId).order("sort_order");if(error)throw error;return NextResponse.json({agenda:(data??[]).map(item=>({startTime:String(item.start_time).slice(0,5),endTime:String(item.end_time).slice(0,5),title:item.title,description:item.description??""}))});}catch(error){const status=apiAuthStatus(error);if(status)return NextResponse.json({message:status===401?"로그인이 만료되었어요. 다시 로그인해주세요.":"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."},{status});const failure=operationErrorMessage(error);return NextResponse.json({message:failure.message},{status:failure.status});}
}

export async function POST(request:Request){
  try{
    const {supabase,user}=await requireApiUser("community_host");const parsed=AgendaSuggestionInputSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({message:"제안을 위해 필요한 정보를 먼저 입력해주세요."},{status:400});
    guardOperationCall(user.id,parsed.data);const context=await getOperationContext(supabase,parsed.data.communityId,parsed.data.scheduleId);if(!context.schedule?.startTime||!context.schedule.endTime)return NextResponse.json({message:"모임 시작 시간과 종료 시간을 먼저 입력해주세요."},{status:400});
    const suggestion=await parseOperationSuggestion(AgendaSuggestionSchema,"operation_agenda_suggestion",OPERATION_AGENDA_PROMPT,{context,request:parsed.data});validateAgenda(suggestion.agenda,context.schedule.startTime,context.schedule.endTime);
    return NextResponse.json({suggestion});
  }catch(error){console.error("[MODIZA][operation-agenda] suggestion failed",error);const status=apiAuthStatus(error);if(status)return NextResponse.json({message:status===401?"로그인이 만료되었어요. 다시 로그인해주세요.":"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."},{status});const failure=operationErrorMessage(error);return NextResponse.json({message:failure.message},{status:failure.status});}
}

export async function PUT(request:Request){
  try{
    const {supabase}=await requireApiUser("community_host");const parsed=AgendaApplySchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({message:"진행 순서를 확인해주세요."},{status:400});const context=await getOperationContext(supabase,parsed.data.communityId,parsed.data.scheduleId);if(!context.schedule?.endTime)return NextResponse.json({message:"모임 시작 시간과 종료 시간을 먼저 입력해주세요."},{status:400});validateAgenda(parsed.data.agenda,context.schedule.startTime,context.schedule.endTime);
    const removed=await supabase.from("schedule_agenda_items").delete().eq("schedule_id",parsed.data.scheduleId);if(removed.error)throw removed.error;const rows=parsed.data.agenda.map((item,index)=>({schedule_id:parsed.data.scheduleId,community_id:parsed.data.communityId,start_time:item.startTime,end_time:item.endTime,title:item.title,description:item.description||null,sort_order:index}));const inserted=await supabase.from("schedule_agenda_items").insert(rows);if(inserted.error)throw inserted.error;return NextResponse.json({saved:rows.length});
  }catch(error){console.error("[MODIZA][operation-agenda] apply failed",error);const status=apiAuthStatus(error);if(status)return NextResponse.json({message:status===401?"로그인이 만료되었어요. 다시 로그인해주세요.":"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."},{status});const failure=operationErrorMessage(error);return NextResponse.json({message:failure.message},{status:failure.status});}
}
