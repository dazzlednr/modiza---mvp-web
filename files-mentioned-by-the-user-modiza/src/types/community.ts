import { z } from "zod";
import { communityCategories, PRIMARY_REGION, subRegions } from "@/constants/taxonomy";

export { communityCategories } from "@/constants/taxonomy";
export type CommunityStatus = "draft" | "published" | "ended" | "inactive";
export type RecruitmentStatus = "recruiting" | "closed" | "upcoming";
export type ParticipationType = "offline" | "online" | "hybrid";
export type MeetingFrequencyType = "one_time" | "weekly" | "biweekly" | "monthly" | "custom";
export type CommunityActivityImage = { id:string; communityId:string; storagePath:string; publicUrl:string; fileName:string|null; sortOrder:number; createdAt:string };
export type CommunityHostProfile = { userId:string; nickname:string; profileImage:string|null; headline:string; introduction:string; activityRegion:string|null; interestCategories:string[]; operatingStyles:string[]; startedAt:string; createdAt:string; updatedAt:string };

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
  meetingFrequencyType:z.enum(["one_time","weekly","biweekly","monthly","custom"]).default("one_time"), meetingFrequencyLabel:z.string().trim().max(80).nullable().optional(),
  recommendedFor:z.array(z.string().trim().min(1)).max(8).default([]), participationNotices:z.array(z.string().trim().min(1)).max(10).default([]), durationMinutes:z.number().int().min(30).max(1440).default(120),
});
export type CommunityFormValues=z.infer<typeof CommunityFormSchema>;
export type CreateCommunityInput=CommunityFormValues&{status:CommunityStatus};
export type UpdateCommunityInput=Partial<CommunityFormValues>&{status?:CommunityStatus};

export type CommunityPlaceRequestSummary={id:string;spaceId:string;spaceSlug:string|null;spaceName:string|null;status:"pending"|"negotiating"|"approved"|"rejected"|"confirmed"|"cancelled";requestType:"inquiry"|"request";requestedDate:string;requestedStartTime:string;requestedEndTime:string};
export type Community={id:string;ownerId?:string|null;operatorId?:string|null;linkedSpaceId?:string|null;name:string;slug:string;category:typeof communityCategories[number];customCategory?:string|null;shortDescription:string;description:string;mainRegion:string;detailedRegion:string;customRegion?:string|null;thumbnailUrl:string;thumbnailStoragePath?:string|null;status:CommunityStatus;recruitmentStatus:RecruitmentStatus;recruitmentStartAt?:string|null;recruitmentEndAt?:string|null;nextMeetingAt?:string|null;meetingEndAt?:string|null;capacity:number;currentMembers:number;participationFee:number;participationType:ParticipationType;targetAudience:string;rules:string;preparationItems:string;activityDescription:string;moodTags:string[];requiredFacilities:string[];indoorOutdoor:"indoor"|"outdoor"|"both";foodDrinkNeeded:boolean;expectedDurationHours:number;budgetMin:number;budgetMax:number;travelRange:string;applicationQuestions:string[];tags:string[];meetingFrequencyType:MeetingFrequencyType;meetingFrequencyLabel:string|null;recommendedFor:string[];participationNotices:string[];durationMinutes:number;createdAt:string;updatedAt:string;linkedSpace?:import("@/types/space").Space|null;hostProfile?:CommunityHostProfile|null;activityImages?:CommunityActivityImage[];otherHostCommunities?:Community[];applicationCount?:number;pendingApplicationCount?:number;placeRequest?:CommunityPlaceRequestSummary|null};

export type ApplicationStatus="pending"|"approved"|"rejected"|"cancelled";
export type CommunityApplication={id:string;communityId:string;communityName:string;applicantUserId?:string|null;applicantName:string;applicantContact:string;introduction:string;motivation:string;answers:Record<string,string>;status:ApplicationStatus;operatorMemo?:string|null;appliedAt:string;updatedAt:string;communitySlug?:string|null;nextMeetingAt?:string|null};
export const CreateCommunityApplicationSchema=z.object({applicantName:z.string().trim().min(1).max(60),applicantContact:z.string().trim().min(3).max(120),introduction:z.string().trim().min(5).max(1000),motivation:z.string().trim().min(5).max(1000),answers:z.record(z.string(),z.string()).default({}),privacyAgreed:z.literal(true)});
export type CreateCommunityApplicationInput=z.infer<typeof CreateCommunityApplicationSchema>;
