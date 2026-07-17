import Link from "next/link";
import { PenLine, Sparkles } from "lucide-react";
import { registrationQueryString, type RegistrationQuery } from "@/lib/community/registration";

export default async function CommunityRegistrationStartPage({ searchParams }: { searchParams: Promise<RegistrationQuery> }) {
  const suffix = registrationQueryString(await searchParams);
  return <section className="section community-start"><div className="container" style={{ maxWidth: 860 }}>
    <div className="panel community-start-card">
      <span className="community-start-icon"><Sparkles /></span>
      <p className="eyebrow">Start with MODIZA</p>
      <h1 className="community-start-title">모디자가 함께 커뮤니티를 만들어드릴게요.</h1>
      <p className="muted community-start-description">처음 운영하는 분도 부담 없이 시작할 수 있도록, 몇 가지 질문에 답하면 모디자가 커뮤니티 등록에 필요한 내용을 함께 정리해드립니다.</p>
      <p className="muted community-start-description community-start-description-secondary">생성된 내용은 언제든 자유롭게 수정할 수 있습니다.</p>
      <div className="community-start-actions">
        <Link className="btn btn-primary" href={`/communities/register/with-modiza${suffix}`}><Sparkles />모디자와 함께 만들기</Link>
        <Link className="btn btn-ghost" href={`/communities/register/write${suffix}`}><PenLine />직접 작성하기</Link>
      </div>
      <small className="muted">모디자와 함께 만들기는 원할 때만 사용하며, 생성된 초안은 자동으로 등록되거나 적용되지 않습니다.</small>
    </div>
  </div></section>;
}
