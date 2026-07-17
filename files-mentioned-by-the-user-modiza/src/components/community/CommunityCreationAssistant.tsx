"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { CommunityForm } from "@/components/community/CommunityForm";
import type { CommunityFormValues } from "@/types/community";
import type { CommunityDraft, CommunityDraftAnswers } from "@/types/communityDraft";

type SpaceOption = {
  id: string;
  name: string;
  mainRegion: string;
  detailedRegion?: string | null;
  customRegion?: string | null;
  address: string;
  maxCapacity: number;
  thumbnailUrl?: string | null;
};

const questions = [
  { key: "idea", title: "어떤 모임을 만들어보고 싶으신가요?", description: "하고 싶은 활동과 모임을 떠올리게 된 계기를 편하게 적어주세요.", placeholder: "예: 퇴근 후 한 달에 한 권씩 읽고 이야기하는 독서모임" },
  { key: "audience", title: "어떤 분들과 함께하고 싶으신가요?", description: "나이보다 관심사나 상황을 중심으로 적어도 좋아요.", placeholder: "예: 책을 좋아하지만 혼자 읽기 아쉬웠던 대구 직장인" },
  { key: "atmosphere", title: "어떤 분위기를 만들고 싶으신가요?", description: "참여자가 모임에서 느꼈으면 하는 분위기를 알려주세요.", placeholder: "예: 조용하지만 어색하지 않고, 서로의 생각을 존중하는 분위기" },
  { key: "capacity", title: "몇 명 정도와 함께하고 싶으신가요?", description: "처음 운영하기 부담 없는 인원을 생각해보세요.", placeholder: "8" },
  { key: "frequency", title: "얼마나 자주 진행하고 싶으신가요?", description: "정확하지 않아도 괜찮습니다. 생각 중인 주기를 알려주세요.", placeholder: "예: 격주 목요일 저녁" },
] as const;

const initialAnswers: CommunityDraftAnswers = { idea: "", audience: "", atmosphere: "", capacity: 8, frequency: "" };

export function CommunityCreationAssistant({ spaces, suggested, directHref }: { spaces: SpaceOption[]; suggested: Partial<CommunityFormValues>; directHref: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [draft, setDraft] = useState<CommunityDraft | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const question = questions[step];
  const value = answers[question.key];
  const canContinue = question.key === "capacity" ? Number(value) >= 2 : String(value).trim().length >= 1;

  async function createDraft(replacing = false) {
    if (replacing && !window.confirm("현재 작성 중인 내용이 있습니다. 새로운 초안으로 변경하시겠습니까?")) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/community-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      if (replacing) {
        const draftKey = suggested.linkedSpaceId ? `modiza:community-draft:new:${suggested.linkedSpaceId}` : "modiza:community-draft:new";
        sessionStorage.removeItem(draftKey);
        setDraftRevision((current) => current + 1);
      }
      setDraft(result.draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안을 정리하지 못했어요.");
    } finally { setLoading(false); }
  }

  if (draft) return <>
    <aside className="registration-guide assisted-guide"><Sparkles /><div><strong>모디자가 먼저 초안을 정리해두었어요.</strong><p>원하는 방향에 맞게 자유롭게 수정해보세요.</p></div><button type="button" className="btn btn-ghost btn-small" disabled={loading} onClick={() => void createDraft(true)}>{loading ? "새 초안을 준비하고 있어요..." : "초안 다시 만들기"}</button></aside>
    {error && <p className="error-summary" role="alert">{error} 현재 작성 내용은 그대로 유지됩니다.</p>}
    <CommunityForm key={draftRevision} spaces={spaces} suggested={{ ...suggested, capacity: answers.capacity, targetAudience: answers.audience, moodTags: [answers.atmosphere], name: draft.name, shortDescription: draft.shortDescription, description: draft.description, activityDescription: draft.recruitmentPost, applicationQuestions: draft.applicationQuestions, tags: draft.tags }} assisted />
  </>;

  return <div className="panel creation-assistant">
    <div className="assistant-progress"><span>질문 {step + 1} / {questions.length}</span><div><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div></div>
    <p className="eyebrow"><Sparkles size={15} />모디자와 함께 만들기</p>
    <h1>{question.title}</h1>
    <p className="muted">{question.description}</p>
    {question.key === "capacity" ? <input className="field assistant-answer" type="number" min={2} max={200} value={answers.capacity} placeholder={question.placeholder} onChange={(event) => setAnswers((current) => ({ ...current, capacity: Number(event.target.value) }))} /> : <textarea className="field assistant-answer" rows={5} maxLength={question.key === "idea" ? 500 : 300} value={String(value)} placeholder={question.placeholder} onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))} />}
    {error && <p className="error-summary" role="alert">{error}</p>}
    <div className="assistant-actions">
      {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep((current) => current - 1)}><ArrowLeft />이전</button> : <Link className="btn btn-ghost" href={directHref}>직접 작성하기</Link>}
      {step < questions.length - 1 ? <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>다음<ArrowRight /></button> : <button type="button" className="btn btn-primary" disabled={!canContinue || loading} onClick={() => void createDraft()}><Sparkles />{loading ? "모디자가 내용을 정리하고 있어요..." : "초안 만들기"}</button>}
    </div>
    <small className="muted">답변은 초안 생성 요청에만 사용되며, 생성된 내용은 자동으로 등록되거나 입력되지 않습니다.</small>
  </div>;
}
