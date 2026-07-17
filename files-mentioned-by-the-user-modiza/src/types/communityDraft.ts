import { z } from "zod";

export const CommunityDraftAnswersSchema = z.object({
  idea: z.string().trim().min(2).max(500),
  audience: z.string().trim().min(2).max(300),
  atmosphere: z.string().trim().min(1).max(200),
  capacity: z.number().int().min(2).max(200),
  frequency: z.string().trim().min(1).max(100),
});

export const CommunityDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  shortDescription: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1600),
  recruitmentPost: z.string().trim().min(1).max(1200),
  applicationQuestions: z.array(z.string().trim().min(1).max(160)).min(1).max(3),
  tags: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
});

export type CommunityDraftAnswers = z.infer<typeof CommunityDraftAnswersSchema>;
export type CommunityDraft = z.infer<typeof CommunityDraftSchema>;
