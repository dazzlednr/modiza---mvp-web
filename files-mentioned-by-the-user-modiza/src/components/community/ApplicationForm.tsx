"use client";

import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CommunityForApplication = {
  id: string;
  name: string;
  slug: string;
  questions: string[];
  canApply: boolean;
  disabledReason?: string;
  nextMeetingAt?: string | null;
};

export function ApplicationForm({ community, applicant }: {
  community: CommunityForApplication;
  applicant?: { nickname: string; email: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    applicantName: applicant?.nickname ?? "",
    applicantContact: applicant?.email ?? "",
    introduction: "",
    motivation: "",
    privacyAgreed: false,
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function start() {
    if (!applicant) {
      router.push(`/login?next=${encodeURIComponent(`/communities/${community.slug}`)}`);
      return;
    }
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/communities/${community.id}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, answers }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "신청을 저장하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={!community.canApply} onClick={start}>
      {community.canApply ? applicant ? "참여 신청" : "로그인하고 참여 신청" : "신청 불가"}
    </button>
    {!community.canApply && <p className="muted">{community.disabledReason}</p>}
    {open && <div className="dialog-backdrop">
      <div className="dialog application-dialog">
        <button type="button" className="dialog-close" aria-label="닫기" onClick={() => setOpen(false)}><X /></button>
        {done ? <div className="application-success">
          <CheckCircle2 size={58} color="var(--success)" aria-hidden="true" />
          <h2>커뮤니티 신청이 완료되었어요 🎉</h2>
          <p>운영자가 신청 내용을 확인한 뒤 참가 여부를 안내해드릴게요.</p>
          <p className="application-success-note">참가가 확정되면 사이트 내 알림을 통해 안내드리며,<br />오픈채팅방이 등록되어 있는 경우 함께 입장할 수 있도록 안내됩니다.</p>
          <div className="application-success-actions">
            <Link className="btn btn-ghost" href="/communities">다른 커뮤니티 둘러보기</Link>
            <Link className="btn btn-primary" href="/mypage/applications">신청 내역 보기</Link>
          </div>
        </div> : <form className="form" onSubmit={submit}>
          <h2>{community.name} 참여 신청</h2>
          <label>이름 또는 닉네임<input className="field" required value={values.applicantName} onChange={(event) => setValues({ ...values, applicantName: event.target.value })} /></label>
          <label>연락처<input className="field" required value={values.applicantContact} onChange={(event) => setValues({ ...values, applicantContact: event.target.value })} /></label>
          <label>간단한 자기소개<textarea className="field" required minLength={5} rows={3} value={values.introduction} onChange={(event) => setValues({ ...values, introduction: event.target.value })} /></label>
          <label>참여 동기<textarea className="field" required minLength={5} rows={3} value={values.motivation} onChange={(event) => setValues({ ...values, motivation: event.target.value })} /></label>
          {community.questions.map((question) => <label key={question}>{question}<textarea className="field" rows={2} value={answers[question] ?? ""} onChange={(event) => setAnswers({ ...answers, [question]: event.target.value })} /></label>)}
          <label className="checkbox-label"><input type="checkbox" required checked={values.privacyAgreed} onChange={(event) => setValues({ ...values, privacyAgreed: event.target.checked })} /> 참여 신청 처리를 위한 개인정보 수집에 동의합니다.</label>
          {error && <p className="error-summary">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>{loading ? "신청 저장 중..." : "신청 완료"}</button>
        </form>}
      </div>
    </div>}
  </>;
}
