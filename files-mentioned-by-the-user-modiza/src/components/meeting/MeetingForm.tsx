"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleHelp, Link2, Save, Users } from "lucide-react";
import type { Meeting, MeetingInput } from "@/types/meeting";

type CommunityOption = { id: string; name: string };
type MeetingFormState = Omit<MeetingInput, "capacity" | "participationFee"> & {
  capacity: string;
  participationFee: string;
};

const blank: MeetingFormState = {
  communityId: null,
  title: "",
  shortDescription: "",
  description: "",
  imageUrl: null,
  eventDate: null,
  startTime: null,
  endTime: null,
  location: null,
  locationIsUndecided: true,
  capacity: "",
  participationFee: "0",
  preparationItems: "",
  recruitmentStartAt: null,
  recruitmentEndAt: null,
  visibility: "discover",
  participantEligibility: "anyone",
};

function localDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function initialState(initial?: Partial<MeetingInput>): MeetingFormState {
  return {
    ...blank,
    ...initial,
    capacity: initial?.capacity ? String(initial.capacity) : "",
    participationFee: String(initial?.participationFee ?? 0),
    recruitmentStartAt: localDateTime(initial?.recruitmentStartAt),
    recruitmentEndAt: localDateTime(initial?.recruitmentEndAt),
  };
}

export function MeetingForm({
  communities,
  initial,
  meeting,
}: {
  communities: CommunityOption[];
  initial?: Partial<MeetingInput>;
  meeting?: Meeting | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<MeetingFormState>(() => initialState(meeting ?? initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const canStartRecruiting = !meeting || meeting.status === "draft" || meeting.status === "closed";
  const title = meeting ? "모임 정보 수정" : "모임 기본 정보 작성";

  const selectedCommunity = useMemo(() => communities.find((item) => item.id === form.communityId) ?? null, [communities, form.communityId]);

  const defaultRecruitmentEndAt = form.eventDate && form.startTime ? `${form.eventDate}T${form.startTime}` : null;
  const effectiveRecruitmentEndAt = form.recruitmentEndAt ?? defaultRecruitmentEndAt;

  function set<K extends keyof MeetingFormState>(key: K, value: MeetingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function input(): MeetingInput {
    const toIso = (value: string | null) => value ? new Date(value).toISOString() : null;
    return {
      ...form,
      communityId: form.communityId || null,
      title: form.title.trim() || "새 모임",
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl || null,
      eventDate: form.eventDate || null,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      location: form.locationIsUndecided ? null : form.location?.trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      participationFee: form.participationFee ? Number(form.participationFee) : 0,
      recruitmentStartAt: toIso(form.recruitmentStartAt),
      recruitmentEndAt: toIso(effectiveRecruitmentEndAt),
      participantEligibility: form.communityId ? form.participantEligibility : "anyone",
    };
  }

  async function save(startRecruiting: boolean) {
    setSaving(true);
    setError("");
    try {
      const meetingInput = input();
      const response = await fetch(meeting ? `/api/meetings/${meeting.id}` : "/api/meetings", {
        method: meeting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meeting ? meetingInput : { meeting: meetingInput, startRecruiting }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "모임을 저장하지 못했어요.");
      if (meeting && startRecruiting && meeting.status !== "recruiting") {
        const statusResponse = await fetch(`/api/meetings/${meeting.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "recruiting" }),
        });
        const statusResult = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusResult.message || "모집을 시작하지 못했어요.");
      }
      router.push("/dashboard/meetings");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "모임을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  const steps = ["기본 정보", "일정과 장소", "모집 설정", "모임 유형과 공개"];

  function goNext() {
    setError("");
    if (step === 1 && !form.title.trim()) {
      setError("모임 이름을 입력해 주세요.");
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  return <div className="meeting-editor">
    <div className="meeting-editor-heading">
      <div><p className="eyebrow">Meeting setup</p><h1>{title}</h1><p>작성 중에는 최소 정보만 저장할 수 있고, 모집 시작 전에 필수 정보를 확인합니다.</p></div>
      {meeting && <span className={`tag meeting-status-${meeting.status}`}>{meeting.status === "draft" ? "준비 중" : meeting.status === "recruiting" ? "모집 중" : meeting.status === "closed" ? "모집 마감" : meeting.status === "completed" ? "종료" : "취소"}</span>}
    </div>
    {error && <p className="error-summary" role="alert">{error}</p>}
    <nav className="meeting-stepper" aria-label="모임 작성 단계">
      {steps.map((label, index) => {
        const number = index + 1;
        return <button key={label} type="button" className={`meeting-step ${step === number ? "active" : ""} ${step > number ? "complete" : ""}`} onClick={() => setStep(number)} aria-current={step === number ? "step" : undefined}>
          <span>{number}</span><strong>{label}</strong>
        </button>;
      })}
    </nav>
    <div className="meeting-editor-grid">
      <main className="form">
        {step === 1 && <section className="panel meeting-form-section">
          <div className="section-heading"><div><span>1</span><h2>기본 정보</h2></div><CalendarDays /></div>
          <div className="form form-grid">
            <label>모임 이름<input className="field" value={form.title} maxLength={100} onChange={(event) => set("title", event.target.value)} placeholder="예: 퇴근 후 글쓰기 모임" /></label>
            <label>대표 이미지 URL <small className="muted">선택</small><input className="field" type="url" value={form.imageUrl ?? ""} onChange={(event) => set("imageUrl", event.target.value || null)} placeholder="https://..." /></label>
            <label style={{ gridColumn: "1 / -1" }}>한 줄 소개<textarea className="field" rows={2} maxLength={180} value={form.shortDescription} onChange={(event) => set("shortDescription", event.target.value)} placeholder="어떤 경험을 함께 나누는 모임인지 알려주세요." /></label>
            <label style={{ gridColumn: "1 / -1" }}>상세 소개<textarea className="field" rows={7} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="진행 방식과 함께하고 싶은 사람을 자유롭게 적어주세요." /></label>
          </div>
        </section>}

        {step === 2 && <section className="panel meeting-form-section">
          <div className="section-heading"><div><span>2</span><h2>일정과 장소</h2></div><CalendarDays /></div>
          <div className="form form-grid">
            <label>진행 날짜<input className="field" type="date" value={form.eventDate ?? ""} onChange={(event) => set("eventDate", event.target.value || null)} /></label>
            <div className="meeting-time-grid"><label>시작 시간<input className="field" type="time" value={form.startTime ?? ""} onChange={(event) => set("startTime", event.target.value || null)} /></label><label>종료 시간<input className="field" type="time" value={form.endTime ?? ""} onChange={(event) => set("endTime", event.target.value || null)} /></label></div>
            <label className="meeting-checkbox" style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={form.locationIsUndecided} onChange={(event) => set("locationIsUndecided", event.target.checked)} /><span><strong>장소 미정</strong><small>모집을 먼저 시작하고 장소는 나중에 정할 수 있어요.</small></span></label>
            {!form.locationIsUndecided && <label style={{ gridColumn: "1 / -1" }}>장소<input className="field" value={form.location ?? ""} onChange={(event) => set("location", event.target.value || null)} placeholder="도로명 주소 또는 장소명" /></label>}
          </div>
        </section>}

        {step === 3 && <section className="panel meeting-form-section">
          <div className="section-heading"><div><span>3</span><h2>모집 설정</h2></div><Users /></div>
          <div className="form form-grid">
            <label>모집 정원<input className="field" type="number" min={1} value={form.capacity} onChange={(event) => set("capacity", event.target.value)} placeholder="예: 12" /></label>
            <label>참가비<input className="field" type="number" min={0} step={1000} value={form.participationFee} onChange={(event) => set("participationFee", event.target.value)} /></label>
            <label>모집 시작 <small className="muted">선택</small><input className="field" type="datetime-local" value={form.recruitmentStartAt ?? ""} onChange={(event) => set("recruitmentStartAt", event.target.value || null)} /></label>
            <label>모집 마감 <small className="muted">기본값: 모임 시작 시각</small><input className="field" type="datetime-local" value={effectiveRecruitmentEndAt ?? ""} onChange={(event) => set("recruitmentEndAt", event.target.value || null)} /></label>
            <label style={{ gridColumn: "1 / -1" }}>준비물<textarea className="field" rows={3} value={form.preparationItems} onChange={(event) => set("preparationItems", event.target.value)} placeholder="없다면 비워두셔도 됩니다." /></label>
          </div>
        </section>}

        {step === 4 && <section className="panel meeting-form-section">
          <div className="section-heading"><div><span>4</span><h2>모임 유형과 공개</h2></div><Link2 /></div>
          <div className="form">
            <label>커뮤니티 연결<select className="field" value={form.communityId ?? ""} onChange={(event) => { const id = event.target.value || null; setForm((current) => ({ ...current, communityId: id, participantEligibility: id ? current.participantEligibility : "anyone" })); }}><option value="">연결하지 않음 · 독립 모임</option>{communities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}</select></label>
            {selectedCommunity && <p className="meeting-inline-note">{selectedCommunity.name}에 연결되지만, 이 모임의 일정·정원·상태는 독립적으로 관리됩니다.</p>}
            <fieldset className="meeting-option-group"><legend>공개 방식</legend><label className="meeting-radio"><input type="radio" name="visibility" checked={form.visibility === "discover"} onChange={() => set("visibility", "discover")} /><span><strong>모디자 탐색에도 공개</strong><small>모집 시작 후 모임 탐색 목록과 공유 URL에서 볼 수 있어요.</small></span></label><label className="meeting-radio"><input type="radio" name="visibility" checked={form.visibility === "link_only"} onChange={() => set("visibility", "link_only")} /><span><strong>링크로만 공개</strong><small>탐색 목록에서는 제외되고 공유 URL로 접근합니다. 비밀 링크 기능은 아니에요.</small></span></label></fieldset>
            <fieldset className="meeting-option-group"><legend>참가 신청 자격</legend><label className="meeting-radio"><input type="radio" name="eligibility" checked={form.participantEligibility === "anyone"} onChange={() => set("participantEligibility", "anyone")} /><span><strong>누구나 신청 가능</strong><small>외부 카카오톡 커뮤니티에 링크를 공유하는 방식도 지원합니다.</small></span></label><label className="meeting-radio"><input type="radio" name="eligibility" disabled={!form.communityId} checked={form.participantEligibility === "community_members"} onChange={() => set("participantEligibility", "community_members")} /><span><strong>연결된 커뮤니티 회원만</strong><small>이번 단계에서는 설정만 저장하며 실제 회원 검증은 후속 개발에서 연결합니다.</small></span></label></fieldset>
          </div>
        </section>}
        <div className="meeting-step-actions">
          <button className="btn btn-ghost" type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>이전</button>
          {step < 4 && <button className="btn btn-primary" type="button" onClick={goNext}>다음 단계</button>}
        </div>
      </main>

      <aside className="meeting-save-panel panel">
        <CircleHelp />
        <h2>저장 방식</h2>
        <p>임시 저장은 모임 이름만 있어도 가능합니다. 임시 저장 상태는 외부에 공개되지 않습니다.</p>
        <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => save(false)}><Save />{saving ? "저장 중..." : meeting ? "변경사항 저장" : "임시 저장"}</button>
        {canStartRecruiting && <button className="btn btn-primary" type="button" disabled={saving} onClick={() => save(true)}><Users />모집 시작</button>}
        <small>모집 시작 시 이름, 날짜, 시작·종료 시간, 정원을 확인합니다.</small>
      </aside>
    </div>
  </div>;
}
