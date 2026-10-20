import { z } from "zod";

export const meetingStatuses = ["draft", "recruiting", "closed", "completed", "cancelled"] as const;
export const meetingVisibilities = ["discover", "link_only"] as const;
export const meetingEligibilityOptions = ["anyone", "community_members"] as const;

export type MeetingStatus = typeof meetingStatuses[number];
export type MeetingVisibility = typeof meetingVisibilities[number];
export type MeetingEligibility = typeof meetingEligibilityOptions[number];

const optionalDate = z.union([z.string().date(), z.literal(""), z.null()]).transform((value) => value || null);
const optionalDateTime = z.union([z.string().datetime({ offset: true }), z.string().datetime({ local: true }), z.literal(""), z.null()]).transform((value) => value || null);
const optionalTime = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal(""), z.null()]).transform((value) => value || null);

export const MeetingInputSchema = z.object({
  communityId: z.union([z.string().uuid(), z.literal(""), z.null()]).transform((value) => value || null).default(null),
  title: z.string().trim().min(1, "모임 이름을 입력해 주세요.").max(100).default("새 모임"),
  shortDescription: z.string().trim().max(180).default(""),
  description: z.string().trim().max(5000).default(""),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).transform((value) => value || null).default(null),
  eventDate: optionalDate.default(null),
  startTime: optionalTime.default(null),
  endTime: optionalTime.default(null),
  location: z.union([z.string().trim().max(200), z.null()]).transform((value) => value || null).default(null),
  locationIsUndecided: z.boolean().default(true),
  capacity: z.union([z.number().int().positive(), z.null()]).default(null),
  participationFee: z.number().int().min(0).default(0),
  preparationItems: z.string().trim().max(2000).default(""),
  recruitmentStartAt: optionalDateTime.default(null),
  recruitmentEndAt: optionalDateTime.default(null),
  visibility: z.enum(meetingVisibilities).default("discover"),
  participantEligibility: z.enum(meetingEligibilityOptions).default("anyone"),
});

export type MeetingInput = z.infer<typeof MeetingInputSchema>;

export type Meeting = MeetingInput & {
  id: string;
  ownerId: string | null;
  sourceMeetingId: string | null;
  slug: string;
  status: MeetingStatus;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  communityName?: string | null;
};

export type MeetingAiAnswers = {
  purpose: string;
  audience: string;
  format: string;
  atmosphere: string;
  notes?: string;
};

export const MeetingAiAnswersSchema = z.object({
  purpose: z.string().trim().min(3).max(500),
  audience: z.string().trim().min(2).max(300),
  format: z.string().trim().min(2).max(300),
  atmosphere: z.string().trim().min(2).max(300),
  notes: z.string().trim().max(500).optional(),
});

export const MeetingAiDraftSchema = z.object({
  title: z.string().trim().min(2).max(100),
  shortDescription: z.string().trim().min(5).max(180),
  description: z.string().trim().min(10).max(3000),
  preparationItems: z.string().trim().max(1000),
});

export type MeetingAiDraft = z.infer<typeof MeetingAiDraftSchema>;
