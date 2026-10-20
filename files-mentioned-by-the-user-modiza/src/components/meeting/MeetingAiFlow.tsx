"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { MeetingForm } from "@/components/meeting/MeetingForm";
import type { MeetingAiAnswers, MeetingAiDraft } from "@/types/meeting";

type CommunityOption = { id: string; name: string; category?: string; detailedRegion?: string | null; moodTags?: string[]; activityDescription?: string | null; budgetMax?: number; expectedDurationHours?: number; requiredFacilities?: string[]; foodDrinkNeeded?: boolean };
type SpaceOption = { id: string; name: string; address: string; addressDetail?: string | null; thumbnailUrl?: string | null };

const initialAnswers: MeetingAiAnswers = { purpose: "", audience: "", format: "", atmosphere: "", notes: "" };

const questions = [
  ["purpose", "이 모임을 여는 목적은 무엇인가요?", "예: 혼자 쓰기 어려운 사람들과 매주 글을 쓰고 싶어요."],
  ["audience", "어떤 사람이 함께하면 좋을까요?", "예: 글쓰기를 처음 시작하는 직장인"],
  ["format", "어떤 방식으로 진행하나요?", "예: 20분 대화 후 60분 각자 글쓰기"],
  ["atmosphere", "원하는 분위기는 어떤가요?", "예: 차분하고 부담 없이 서로 응원하는 분위기"],
] as const;

export function MeetingAiFlow({ communities, spaces }: { communities: CommunityOption[]; spaces: SpaceOption[] }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [draft, setDraft] = useState<MeetingAiDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/meeting-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "초안을 만들지 못했어요.");
      setDraft(result.draft);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "초안을 만들지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (draft) return <>
    <div className="panel meeting-ai-ready"><Sparkles /><div><strong>AI 초안을 입력란에 반영했습니다.</strong><p>아직 저장되지 않았습니다. 내용을 직접 검토하고 일정·정원·공개 설정을 추가해 주세요.</p></div><button type="button" className="btn btn-ghost btn-small" onClick={() => setDraft(null)}><ArrowLeft />답변 수정</button></div>
    <MeetingForm communities={communities} spaces={spaces} initial={draft} />
  </>;

  return <section className="panel meeting-ai-flow">
    <div className="meeting-ai-icon"><Sparkles /></div>
    <p className="eyebrow">AI meeting draft</p>
    <h1>어떤 모임을 열고 싶으신가요?</h1>
    <p className="muted">몇 가지 답변을 바탕으로 이름과 소개 초안만 만듭니다. 날짜·장소·가격은 임의로 생성하지 않습니다.</p>
    <div className="meeting-ai-progress"><span>{step + 1} / {questions.length + 1}</span><div className="progress-track"><i style={{ width: `${((step + 1) / (questions.length + 1)) * 100}%` }} /></div></div>
    <div className="form meeting-ai-questions">
      {step < questions.length ? (() => { const [key, title, placeholder] = questions[step]; return <label><strong>{title}</strong><textarea className="field" rows={5} value={answers[key]} onChange={(event) => setAnswers((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} autoFocus /></label>; })() : <label><strong>AI가 참고할 내용을 자유롭게 적어주세요.</strong><small className="muted">선택</small><textarea className="field" rows={5} value={answers.notes ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, notes: event.target.value }))} placeholder="꼭 반영했으면 하는 내용이 있다면 적어주세요." autoFocus /></label>}
    </div>
    {error && <p className="error-summary" role="alert">{error}</p>}
    <div className="assistant-actions"><Link className="btn btn-ghost" href="/meetings/new">처음으로</Link><div className="assistant-actions">{step > 0 && <button className="btn btn-ghost" type="button" onClick={() => setStep((current) => current - 1)}>이전</button>}{step < questions.length ? <button className="btn btn-primary" type="button" disabled={!answers[questions[step][0]].trim()} onClick={() => setStep((current) => current + 1)}>다음</button> : <button className="btn btn-primary" type="button" disabled={loading || questions.some(([key]) => !answers[key].trim())} onClick={generate}><Sparkles />{loading ? "초안 만드는 중..." : "AI 초안 만들기"}</button>}</div></div>
    <p className="meeting-ai-fallback">AI가 비활성화되거나 실패해도 <Link href="/meetings/new/write">직접 작성</Link>으로 언제든 계속할 수 있어요.</p>
  </section>;
}
