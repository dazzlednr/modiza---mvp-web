import Image from "next/image";
import Link from "next/link";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const query = await searchParams;
  const pending=query.status==="pending";
  return <section className="section"><div className="container" style={{ maxWidth: 760 }}><div className="panel" style={{ textAlign: "center" }}>{query.image && <div className="cover"><Image src={query.image} fill alt="대표 이미지" /></div>}<h1>{pending ? "공간 인증 신청이 접수됐어요!" : "임시 저장했어요."}</h1><h2>{query.name}</h2><span className="tag">{pending?"심사 중":"임시 저장"}</span>{pending&&<p className="muted">관리자 확인 후 승인되면 이용자에게 공개됩니다. 인증 결과는 사이트 내 알림으로 안내해드릴게요.</p>}<div className="meta" style={{ justifyContent: "center", marginTop: 24 }}>{query.status==="approved"&&query.slug&&<Link className="btn btn-ghost" href={`/spaces/${query.slug}`}>등록한 공간 보기</Link>}<Link className="btn btn-primary" href="/dashboard/spaces">내 공간 관리하기</Link></div></div></div></section>;
}
