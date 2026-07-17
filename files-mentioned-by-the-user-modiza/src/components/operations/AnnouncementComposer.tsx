"use client";

import { useMemo, useState } from "react";
import { Copy, Megaphone, Sparkles, X } from "lucide-react";
import type { Community } from "@/types/community";
import type { Schedule } from "@/types/operator";
import {
  MessageKinds,
  type MessageSuggestion,
} from "@/types/operation-suggestion";
import { useOperationAi } from "@/components/operations/useOperationAi";

type MessageKind = (typeof MessageKinds)[number];

export function AnnouncementComposer({
  communities,
  schedules,
  initialCommunityId,
  initialScheduleId,
  initialKind = "첫 모임 안내",
  label = "공지 작성",
  className = "btn btn-ghost",
}: {
  communities: Community[];
  schedules: Schedule[];
  initialCommunityId?: string;
  initialScheduleId?: string;
  initialKind?: MessageKind;
  label?: string;
  className?: string;
}) {
  const aiEnabled = useOperationAi();
  const [open, setOpen] = useState(false);
  const [communityId, setCommunityId] = useState(initialCommunityId ?? communities[0]?.id ?? "");
  const communitySchedules = useMemo(
    () => schedules.filter((item) => item.communityId === communityId),
    [communityId, schedules],
  );
  const [scheduleId, setScheduleId] = useState(initialScheduleId ?? "");
  const [kind, setKind] = useState<MessageKind>(initialKind);
  const [extra, setExtra] = useState("");
  const [tone, setTone] = useState("친근하고 따뜻하게");
  const [length, setLength] = useState("보통");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function changesFor(value: MessageKind) {
    if (value === "장소 변경") return ["장소"];
    if (value === "시간 변경") return ["시간"];
    if (value === "준비물 안내") return ["준비물"];
    return [];
  }

  async function generate() {
    if (!communityId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operations/message-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId,
          scheduleId: scheduleId || communitySchedules[0]?.id || null,
          kind,
          changes: changesFor(kind),
          extra,
          tone,
          length,
          variation: "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      const suggestion = payload.suggestion as MessageSuggestion;
      if (draft.trim() && !window.confirm("현재 작성 중인 공지가 있어요. 새 초안으로 바꿀까요?")) return;
      setDraft(`${suggestion.title}\n\n${suggestion.body}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "공지 초안을 준비하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!draft.trim()) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>
      <Megaphone size={17} />{label}
    </button>
    {open && <div className="dialog-backdrop" role="presentation">
      <section className="dialog operation-dialog announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">운영 안내</p>
            <h2 id="announcement-title">참가자 공지 작성</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="닫기"><X /></button>
        </div>
        <p className="muted">모디자의 제안은 초안입니다. 내용을 확인하고 수정한 뒤 필요한 채널에 직접 복사해 사용해주세요.</p>
        <div className="grid form-grid">
          <label>커뮤니티
            <select className="field" value={communityId} onChange={(event) => { setCommunityId(event.target.value); setScheduleId(""); }}>
              {communities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>공지 종류
            <select className="field" value={kind} onChange={(event) => setKind(event.target.value as MessageKind)}>
              {MessageKinds.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>대상 일정
            <select className="field" value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}>
              <option value="">가장 가까운 일정</option>
              {communitySchedules.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.title}</option>)}
            </select>
          </label>
          <label>말투
            <select className="field" value={tone} onChange={(event) => setTone(event.target.value)}>
              <option>친근하고 따뜻하게</option><option>친근하게</option><option>따뜻하게</option><option>차분하게</option><option>공식적으로</option>
            </select>
          </label>
        </div>
        <label>추가로 반영할 내용
          <textarea className="field" rows={3} maxLength={800} value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="꼭 전달해야 할 장소, 준비물, 주의사항 등을 적어주세요." />
        </label>
        <div className="meta">
          <label>길이
            <select className="field compact-field" value={length} onChange={(event) => setLength(event.target.value)}>
              <option>짧게</option><option>보통</option><option>자세하게</option>
            </select>
          </label>
          {aiEnabled && <button type="button" className="btn btn-primary" disabled={loading || !communityId} onClick={() => void generate()}>
            <Sparkles size={17} />{loading ? "초안을 준비하는 중..." : "모디자에게 초안 제안받기"}
          </button>}
        </div>
        {!aiEnabled && <p className="operation-ai-note">직접 작성할 수 있어요. 모디자 초안 기능은 OpenAI 연결 시 함께 표시됩니다.</p>}
        <label>공지 내용
          <textarea className="field announcement-draft" rows={11} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="참가자에게 전달할 공지를 작성해주세요." />
        </label>
        {error && <p className="error-summary" role="alert">{error}</p>}
        <div className="meta announcement-actions">
          <button type="button" className="btn btn-ghost" disabled={!draft.trim()} onClick={() => void copy()}><Copy size={16} />{copied ? "복사했어요" : "공지 복사"}</button>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>작성 마치기</button>
        </div>
      </section>
    </div>}
  </>;
}
