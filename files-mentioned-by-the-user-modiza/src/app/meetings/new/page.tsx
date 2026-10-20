import Link from "next/link";
import { PenLine, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/access";

export default async function NewMeetingPage() {
  await requireRole("community_host", "/meetings/new");
  return <section className="section community-start"><div className="container"><div className="panel meeting-start-card">
    <p className="eyebrow">New meeting</p><h1>새 모임을 어떻게 만들까요?</h1><p className="muted">두 방식 모두 같은 모임 관리 구조에 저장되며, 저장 전에 언제든 내용을 수정할 수 있습니다.</p>
    <div className="meeting-start-options">
      <Link href="/meetings/new/ai"><span><Sparkles /></span><h2>AI와 함께 만들기</h2><p>목적과 분위기를 답하면 이름·소개·준비물 초안을 만들어드려요.</p><b>초안 만들기 →</b></Link>
      <Link href="/meetings/new/write"><span><PenLine /></span><h2>직접 작성하기</h2><p>필요한 정보를 직접 입력하고 최소 정보만으로 임시 저장할 수 있어요.</p><b>직접 시작하기 →</b></Link>
    </div>
  </div></div></section>;
}
