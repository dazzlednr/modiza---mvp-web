import Link from "next/link";
import { House, PenLine, Sparkles } from "lucide-react";

export default function SpaceRegistrationStartPage() {
  return <section className="section community-start"><div className="container" style={{ maxWidth: 860 }}>
    <div className="panel community-start-card">
      <span className="community-start-icon"><House /></span>
      <p className="eyebrow">Register with MODIZA</p>
      <h1>모디자가 함께 공간을 등록해드릴게요.</h1>
      <p className="muted">다양한 각도의 사진을 올리면 시설, 분위기, 적합한 활동을 먼저 채워드릴 수 있습니다.</p>
      <p className="muted">이후 원하는 내용은 언제든 자유롭게 수정할 수 있습니다.</p>
      <div className="community-start-actions">
        <Link className="btn btn-primary" href="/spaces/register/with-modiza"><Sparkles />모디자와 함께 등록하기</Link>
        <Link className="btn btn-ghost" href="/spaces/register/write"><PenLine />직접 작성하기</Link>
      </div>
      <small className="muted">AI 분석 결과는 초안으로만 입력되며, 확인 전에는 공간 정보로 저장되지 않습니다.</small>
    </div>
  </div></section>;
}
