import type { MeetingInput, MeetingStatus } from "@/types/meeting";

export const meetingStatusLabels: Record<MeetingStatus, string> = {
  draft: "준비 중",
  recruiting: "모집 중",
  closed: "모집 마감",
  completed: "종료",
  cancelled: "취소",
};

export const allowedMeetingStatusTransitions: Record<MeetingStatus, MeetingStatus[]> = {
  draft: ["recruiting", "cancelled"],
  recruiting: ["closed", "completed", "cancelled"],
  closed: ["recruiting", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionMeetingStatus(current: MeetingStatus, next: MeetingStatus) {
  return current === next || allowedMeetingStatusTransitions[current].includes(next);
}

export function getMeetingPublishErrors(value: MeetingInput) {
  const errors: string[] = [];
  if (value.title.trim().length < 2) errors.push("모임 이름은 2자 이상 입력해 주세요.");
  if (!value.eventDate) errors.push("진행 날짜를 입력해 주세요.");
  if (!value.startTime) errors.push("시작 시간을 입력해 주세요.");
  if (!value.endTime) errors.push("종료 시간을 입력해 주세요.");
  if (value.startTime && value.endTime && value.endTime <= value.startTime) errors.push("종료 시간은 시작 시간보다 늦어야 해요.");
  if (!value.capacity || value.capacity < 1) errors.push("모집 정원을 1명 이상으로 입력해 주세요.");
  if (value.recruitmentStartAt && value.recruitmentEndAt && value.recruitmentEndAt <= value.recruitmentStartAt) {
    errors.push("모집 마감은 모집 시작보다 늦어야 해요.");
  }
  if (value.participantEligibility === "community_members" && !value.communityId) {
    errors.push("커뮤니티 회원 전용 모임은 커뮤니티를 연결해야 해요.");
  }
  return errors;
}

export function assertMeetingReady(value: MeetingInput) {
  const errors = getMeetingPublishErrors(value);
  if (errors.length) throw new Error(`MEETING_NOT_READY:${errors.join("|")}`);
}

export function getMeetingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("MEETING_NOT_READY:")) return message.slice("MEETING_NOT_READY:".length).split("|")[0];
  if (message.includes("INVALID_MEETING_STATUS_TRANSITION")) return "현재 상태에서는 요청한 상태로 변경할 수 없어요.";
  if (message === "MEETING_NOT_FOUND") return "모임을 찾을 수 없거나 수정 권한이 없어요.";
  if (message === "COMMUNITY_NOT_OWNED") return "내가 운영하는 커뮤니티만 연결할 수 있어요.";
  return "모임 정보를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
