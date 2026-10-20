"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { MeetingForm } from "@/components/meeting/MeetingForm";
import type { MeetingAiAnswers, MeetingAiDraft } from "@/types/meeting";

type CommunityOption = { id: string; name: string };

const initialAnswers: MeetingAiAnswers = { purpose: "", audience: "", format: "", atmosphere: "", notes: "" };

export function MeetingAiFlow({ communities }: { communities: CommunityOption[] }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [draft, setDraft] = useState<MeetingAiDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <MeetingForm communities={communities} initial={draft} />
  </>;

  return <section className="panel meeting-ai-flow">
    <div className="meeting-ai-icon"><Sparkles /></div>
    <p className="eyebrow">AI meeting draft</p>
    <h1>어떤 모임을 열고 싶으신가요?</h1>
    <p className="muted">몇 가지 답변을 바탕으로 이름과 소개 초안만 만듭니다. 날짜·장소·가격은 임의로 생성하지 않습니다.</p>
    {error && <p className="error-summary" role="alert">{error}</p>}
    <div className="form meeting-ai-questions">
      <label>이 모임을 여는 목적은 무엇인가요?<textarea className="field" rows={3} value={answers.purpose} onChange={(event) => setAnswers((current) => ({ ...current, purpose: event.target.value }))} placeholder="예: 혼자 쓰기 어려운 사람들과 매주 글을 쓰고 싶어요." /></label>
      <label>어떤 사람이 함께하면 좋을까요?<textarea className="field" rows={3} value={answers.audience} onChange={(event) => setAnswers((current) => ({ ...current, audience: event.target.value }))} placeholder="예: 글쓰기를 처음 시작하는 직장인" /></label>
      <label>어떤 방식으로 진행하나요?<textarea className="field" rows={3} value={answers.format} onChange={(event) => setAnswers((current) => ({ ...current, format: event.target.value }))} placeholder="예: 20분 대화 후 60분 각자 글쓰기" /></label>
      <label>원하는 분위기는 어떤가요?<textarea className="field" rows={3} value={answers.atmosphere} onChange={(event) => setAnswers((current) => ({ ...current, atmosphere: event.target.value }))} placeholder="예: 차분하고 부담 없이 서로 응원하는 분위기" /></label>
      <label>AI가 참고할 내용 <small className="muted">선택</small><textarea className="field" rows={3} value={answers.notes ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, notes: event.target.value }))} /></label>
    </div>
    <div className="assistant-actions"><Link className="btn btn-ghost" href="/meetings/new">이전</Link><button className="btn btn-primary" type="button" disabled={loading || !answers.purpose.trim() || !answers.audience.trim() || !answers.format.trim() || !answers.atmosphere.trim()} onClick={generate}><Sparkles />{loading ? "초안 만드는 중..." : "AI 초안 만들기"}</button></div>
    <p className="meeting-ai-fallback">AI가 비활성화되거나 실패해도 <Link href="/meetings/new/write">직접 작성</Link>으로 언제든 계속할 수 있어요.</p>
  </section>;
}
