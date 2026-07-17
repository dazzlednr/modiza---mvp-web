import { z } from "zod";

export const MessageKinds=[
  "신청 승인",
  "첫 모임 안내",
  "하루 전 안내",
  "당일 안내",
  "장소 변경",
  "시간 변경",
  "준비물 안내",
  "모집 마감",
  "모임 취소",
  "모임 종료 감사",
] as const;
export const MessageSuggestionInputSchema=z.object({communityId:z.string().uuid(),scheduleId:z.string().uuid().nullable().optional(),kind:z.enum(MessageKinds),changes:z.array(z.enum(["장소","시간","준비물","기타"])).max(4).default([]),extra:z.string().trim().max(800).default(""),tone:z.enum(["친근하고 따뜻하게","친근하게","따뜻하게","차분하게","공식적으로"]).default("친근하고 따뜻하게"),length:z.enum(["짧게","보통","자세하게"]).default("보통"),variation:z.string().trim().max(200).default("")});
export const MessageSuggestionSchema=z.object({title:z.string().trim().min(1).max(100),body:z.string().trim().min(1).max(3000)});
export type MessageSuggestion=z.infer<typeof MessageSuggestionSchema>;

export const ChecklistSuggestionInputSchema=z.object({communityId:z.string().uuid(),scheduleId:z.string().uuid().nullable().optional(),target:z.enum(["next","specific","common"]),scope:z.enum(["모임 전","모임 당일","모임 이후","전체"]),special:z.string().trim().max(500).default(""),activity:z.string().trim().max(500).default(""),exclude:z.string().trim().max(500).default(""),variation:z.string().trim().max(200).default("")});
export const ChecklistSuggestionSchema=z.object({groups:z.array(z.object({name:z.enum(["모임 전","모임 당일","모임 이후","커뮤니티 공통"]),items:z.array(z.string().trim().min(1).max(120)).min(1).max(6)})).min(1).max(4)}).superRefine((value,ctx)=>{if(value.groups.flatMap(group=>group.items).length>15)ctx.addIssue({code:"custom",message:"체크리스트 제안은 최대 15개입니다."});});
export const ChecklistApplySchema=z.object({communityId:z.string().uuid(),groups:ChecklistSuggestionSchema.shape.groups});
export type ChecklistSuggestion=z.infer<typeof ChecklistSuggestionSchema>;

const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const AgendaSuggestionInputSchema=z.object({communityId:z.string().uuid(),scheduleId:z.string().uuid(),purpose:z.string().trim().min(1).max(500),activity:z.string().trim().min(1).max(500),atmosphere:z.string().trim().max(300).default(""),includeBreak:z.boolean().default(false),includeIntroduction:z.boolean().default(true),includeClosing:z.boolean().default(true),extra:z.string().trim().max(500).default(""),variation:z.string().trim().max(200).default("")});
export const AgendaItemSchema=z.object({startTime:time,endTime:time,title:z.string().trim().min(1).max(100),description:z.string().trim().max(500).default("")});
export const AgendaSuggestionSchema=z.object({agenda:z.array(AgendaItemSchema).min(1).max(12)});
export const AgendaApplySchema=z.object({communityId:z.string().uuid(),scheduleId:z.string().uuid(),agenda:AgendaSuggestionSchema.shape.agenda});
export type AgendaItem=z.infer<typeof AgendaItemSchema>;
export type AgendaSuggestion=z.infer<typeof AgendaSuggestionSchema>;
