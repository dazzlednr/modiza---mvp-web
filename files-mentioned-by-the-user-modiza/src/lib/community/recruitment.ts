import type { Community, RecruitmentStatus } from "@/types/community";

export type DisplayRecruitmentStatus = RecruitmentStatus | "full" | "completed";

export function recruitmentWindow(meetingStartAt: string, createdAt = new Date()) {
  const meeting = new Date(meetingStartAt);
  return { startAt: createdAt.toISOString(), endAt: new Date(meeting.getTime() - 60 * 60 * 1000).toISOString() };
}

export function calculateRecruitmentStatus(community: Pick<Community,"nextMeetingAt"|"capacity"|"currentMembers"|"status">, now = new Date()): DisplayRecruitmentStatus {
  if (!community.nextMeetingAt || community.status !== "published") return "closed";
  const meeting = new Date(community.nextMeetingAt);
  if (now >= meeting) return "completed";
  if (community.currentMembers >= community.capacity) return "full";
  if (now >= new Date(meeting.getTime() - 60 * 60 * 1000)) return "closed";
  return "recruiting";
}

export const recruitmentLabels: Record<DisplayRecruitmentStatus,string> = { recruiting:"모집 중", upcoming:"모집 예정", closed:"모집 마감", full:"모집 완료", completed:"진행 완료" };
