import { NextResponse } from "next/server";
import { requireApiUser,apiAuthStatus } from "@/lib/auth/api";
import { getOperationContext,guardOperationCall,operationErrorMessage,parseOperationSuggestion } from "@/lib/operations/server";
import { OPERATION_MESSAGE_PROMPT } from "@/lib/operations/prompts";
import { MessageSuggestionInputSchema,MessageSuggestionSchema } from "@/types/operation-suggestion";

export async function POST(request:Request){
  try{
    const {supabase,user}=await requireApiUser("community_host");
    const parsed=MessageSuggestionInputSchema.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({message:"제안을 위해 필요한 정보를 먼저 입력해주세요."},{status:400});
    guardOperationCall(user.id,parsed.data);
    const context=await getOperationContext(supabase,parsed.data.communityId,parsed.data.scheduleId);
    const suggestion=await parseOperationSuggestion(MessageSuggestionSchema,"operation_message_suggestion",OPERATION_MESSAGE_PROMPT,{context,request:{kind:parsed.data.kind,changes:parsed.data.changes,extra:parsed.data.extra,tone:parsed.data.tone,length:parsed.data.length,variation:parsed.data.variation}});
    return NextResponse.json({suggestion});
  }catch(error){console.error("[MODIZA][operation-message] suggestion failed",error);const status=apiAuthStatus(error);if(status)return NextResponse.json({message:status===401?"로그인이 만료되었어요. 다시 로그인해주세요.":"이 커뮤니티의 운영 도구를 사용할 권한이 없어요."},{status});const failure=operationErrorMessage(error);return NextResponse.json({message:failure.message},{status:failure.status});}
}
