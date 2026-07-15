import { z } from "zod";
import { communityCategories, PRIMARY_REGION, subRegions } from "@/constants/taxonomy";

export { communityCategories } from "@/constants/taxonomy";
export type CommunityStatus = "draft" | "published" | "ended" | "inactive";
export type RecruitmentStatus = "recruiting" | "closed" | "upcoming";
export type ParticipationType = "offline" | "online" | "hybrid";

export const CommunityFormSchema = z.object({
  name:z.string().trim().min(1).max(80), category:z.enum(communityCategories), customCategory:z.string().trim().max(60).nullable().optional(),
  shortDescription:z.string().trim().min(1).max(160), description:z.string().trim().min(1),
  mainRegion:z.string().trim().min(1).default(PRIMARY_REGION), detailedRegion:z.string().trim().min(1), customRegion:z.string().trim().max(80).nullable().optional(),
  nextMeetingAt:z.string().min(1), meetingEndAt:z.string().nullable().optional(),
  capacity:z.number().int().min(1), participationFee:z.number().int().min(0),
  participationType:z.enum(["offline","online","hybrid"]), recruitmentStatus:z.enum(["recruiting","closed","upcoming"]),
  recruitmentStartAt:z.string().nullable().optional(), recruitmentEndAt:z.string().nullable().optional(),
  targetAudience:z.string().optional(), rules:z.string().optional(), preparationItems:z.string().optional(),
  activityDescription:z.string().default(""), moodTags:z.array(z.string()).default([]), requiredFacilities:z.array(z.string()).default([]), indoorOutdoor:z.enum(["indoor","outdoor","both"]).default("indoor"), foodDrinkNeeded:z.boolean().default(false), expectedDurationHours:z.number().min(0.5).max(24).default(2), budgetMin:z.number().int().min(0).default(0), budgetMax:z.number().int().min(0).default(0), travelRange:z.string().default(""),
  applicationQuestions:z.array(z.string().trim().min(1)).default([]), tags:z.preprocess(value=>typeof value==="string"?value.split(",").map(item=>item.trim()).filter(Boolean):value,z.array(z.string())).default([]),
  linkedSpaceId:z.string().uuid().nullable().optional(),
});
export type CommunityFormValues=z.infer<typeof CommunityFormSchema>;
export type CreateCommunityInput=CommunityFormValues&{status:CommunityStatus};
export type UpdateCommunityInput=Partial<CommunityFormValues>&{status?:CommunityStatus};

export type Community={id:string;ownerId?:string|null;operatorId?:string|null;linkedSpaceId?:string|null;name:string;slug:string;category:typeof communityCategories[number];customCategory?:string|null;shortDescription:string;description:string;mainRegion:string;detailedRegion:string;customRegion?:string|null;thumbnailUrl:string;thumbnailStoragePath?:string|null;status:CommunityStatus;recruitmentStatus:RecruitmentStatus;recruitmentStartAt?:string|null;recruitmentEndAt?:string|null;nextMeetingAt?:string|null;meetingEndAt?:string|null;capacity:number;currentMembers:number;participationFee:number;participationType:ParticipationType;targetAudience:string;rules:string;preparationItems:string;activityDescription:string;moodTags:string[];requiredFacilities:string[];indoorOutdoor:"indoor"|"outdoor"|"both";foodDrinkNeeded:boolean;expectedDurationHours:number;budgetMin:number;budgetMax:number;travelRange:string;applicationQuestions:string[];tags:string[];createdAt:string;updatedAt:string;linkedSpace?:import("@/types/space").Space|null;applicationCount?:number;pendingApplicationCount?:number};

export type ApplicationStatus="pending"|"approved"|"rejected"|"cancelled";
export type CommunityApplication={id:string;communityId:string;communityName:string;applicantUserId?:string|null;applicantName:string;applicantContact:string;introduction:string;motivation:string;answers:Record<string,string>;status:ApplicationStatus;operatorMemo?:string|null;appliedAt:string;updatedAt:string;communitySlug?:string|null;nextMeetingAt?:string|null};
export const CreateCommunityApplicationSchema=z.object({applicantName:z.string().trim().min(1).max(60),applicantContact:z.string().trim().min(3).max(120),introduction:z.string().trim().min(5).max(1000),motivation:z.string().trim().min(5).max(1000),answers:z.record(z.string(),z.string()).default({}),privacyAgreed:z.literal(true)});
export type CreateCommunityApplicationInput=z.infer<typeof CreateCommunityApplicationSchema>;
