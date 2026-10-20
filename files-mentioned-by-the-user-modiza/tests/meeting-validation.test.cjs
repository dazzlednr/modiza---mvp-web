const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = readFileSync(join(__dirname, "../src/lib/meeting/validation.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "module", "require", compiled)(loaded.exports, loaded, require);

const {
  canTransitionMeetingStatus,
  getMeetingPublishErrors,
} = loaded.exports;

const readyMeeting = {
  communityId: null,
  title: "퇴근 후 글쓰기",
  shortDescription: "",
  description: "",
  imageUrl: null,
  eventDate: "2026-11-01",
  startTime: "19:00",
  endTime: "21:00",
  location: null,
  locationIsUndecided: true,
  capacity: 12,
  participationFee: 0,
  preparationItems: "",
  recruitmentStartAt: null,
  recruitmentEndAt: null,
  visibility: "discover",
  participantEligibility: "anyone",
};

test("모집 시작에 필요한 기본 정보를 검증한다", () => {
  assert.deepEqual(getMeetingPublishErrors(readyMeeting), []);
  assert.ok(getMeetingPublishErrors({ ...readyMeeting, eventDate: null }).some((message) => message.includes("진행 날짜")));
  assert.ok(getMeetingPublishErrors({ ...readyMeeting, endTime: "18:00" }).some((message) => message.includes("종료 시간")));
});

test("커뮤니티 회원 전용은 커뮤니티 연결이 필요하다", () => {
  const errors = getMeetingPublishErrors({ ...readyMeeting, participantEligibility: "community_members" });
  assert.ok(errors.some((message) => message.includes("커뮤니티를 연결")));
});

test("모임 상태 전이 규칙을 적용한다", () => {
  assert.equal(canTransitionMeetingStatus("draft", "recruiting"), true);
  assert.equal(canTransitionMeetingStatus("closed", "recruiting"), true);
  assert.equal(canTransitionMeetingStatus("completed", "recruiting"), false);
  assert.equal(canTransitionMeetingStatus("cancelled", "draft"), false);
});
