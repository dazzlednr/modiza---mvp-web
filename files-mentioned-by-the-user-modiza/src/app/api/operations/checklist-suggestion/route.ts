import { NextResponse } from "next/server";
import { requireApiUser,apiAuthStatus } from "@/lib/auth/api";
import { getOperationContext,guardOperationCall,operationErrorMessage,parseOperationSuggestion } from "@/lib/operations/server";
import { OPERATION_CHECKLIST_PROMPT } from "@/lib/operations/prompts";
import { ChecklistApplySchema,ChecklistSuggestionInputSchema,ChecklistSuggestionSchema } from "@/types/operation-suggestion";

export async function POST(request:Request){
  try{
    const {supabase,user}=await requireApiUser("community_host");
    const parsed=ChecklistSuggestionInputSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({message:"제안을 위해 필요한 정보를 먼저 입력해주세요."},{status:400});
    guardOperationCall(user.id,parsed.data);const context=await getOperationContext(supabase,parsed.data.communityId,parsed.data.scheduleId);
    const {data:existing,error}=await supabase.from("checklist_groups").select("title,checklist_items(title)").eq("community_id",parsed.data.communityId);if(error)throw error;
    const suggestion=await parseOperationSuggestion(ChecklistSuggestionSchema,"operation_checklist_suggestion",OPERATION_CHECKLIST_PROMPT,{context,request:parsed.data,existingItems:(existing??[]).flatMap(group=>(group.checklist_items??[]).map((item:{title:string})=>item.title))});
    return NextResponse.json({suggestion});
  }catch(error){console.error("[MODIZA][operation-checklist] suggestion failed",error);const status=apiAuthStatus(error);if(status)return NextResponse.json({message:status===401?"로그인이 만료되었어요. 다시 로그인해주세요.":"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."},{status});const failure=operationErrorMessage(error);return NextResponse.json({message:failure.message},{status:failure.status});}
}

export async function PUT(request:Request){
  try{
    const {supabase}=await requireApiUser("community_host");const parsed=ChecklistApplySchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({message:"추가할 준비 항목을 확인해주세요."},{status:400});
    await getOperationContext(supabase,parsed.data.communityId);
    const {data:groups,error}=await supabase.from("checklist_groups").select("id,title,display_order,checklist_items(title)").eq("community_id",parsed.data.communityId);if(error)throw error;
    const existingGroups=[...(groups??[])];let added=0;
    for(const proposed of parsed.data.groups){let group=existingGroups.find(item=>item.title===proposed.name);if(!group){const created=await supabase.from("checklist_groups").insert({community_id:parsed.data.communityId,title:proposed.name,display_order:existingGroups.length}).select("id,title,display_order").single();if(created.error)throw created.error;group={...created.data,checklist_items:[]};existingGroups.push(group);}
      const duplicates=new Set((group.checklist_items??[]).map((item:{title:string})=>item.title.trim().toLowerCase()));const items=proposed.items.filter(title=>!duplicates.has(title.trim().toLowerCase())).map(title=>({group_id:group!.id,title}));if(items.length){const inserted=await supabase.from("checklist_items").insert(items);if(inserted.error)throw inserted.error;added+=items.length;}}
    return NextResponse.json({added});
  }catch(error){console.error("[MODIZA][operation-checklist] apply failed",error);const status=apiAuthStatus(error);if(status)return NextResponse.json({message:status===401?"로그인이 만료되었어요. 다시 로그인해주세요.":"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."},{status});const failure=operationErrorMessage(error);return NextResponse.json({message:failure.message},{status:failure.status});}
}
