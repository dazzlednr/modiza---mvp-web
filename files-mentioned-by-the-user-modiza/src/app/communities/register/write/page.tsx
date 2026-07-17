import { CommunityForm } from "@/components/community/CommunityForm";
import { getCommunityRegistrationContext, type RegistrationQuery } from "@/lib/community/registration";

export default async function DirectCommunityRegistrationPage({ searchParams }: { searchParams: Promise<RegistrationQuery> }) {
  const context = await getCommunityRegistrationContext(await searchParams);
  return <section className="section"><div className="container" style={{ maxWidth: 960 }}>
    <p className="eyebrow">Write directly</p>
    <h1 className="section-title">새 커뮤니티 등록</h1>
    <p className="muted">작성 팁과 예시를 참고해 필요한 내용을 직접 채워주세요.</p>
    <CommunityForm spaces={context.spaces} suggested={context.suggested} />
  </div></section>;
}
