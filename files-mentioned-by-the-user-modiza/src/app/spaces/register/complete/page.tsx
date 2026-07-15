import Image from "next/image";
import Link from "next/link";
import { SpaceAnalysisPanel } from "@/components/space/SpaceAnalysisPanel";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMySpaces } from "@/repositories/spaceRepository";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const query = await searchParams;
  const space = (await getMySpaces(await createAuthServerSupabaseClient())).find((item) => item.slug === query.slug);
  return <section className="section"><div className="container" style={{ maxWidth: 760 }}><div className="panel" style={{ textAlign: "center" }}>{query.image && <div className="cover"><Image src={query.image} fill alt="대표 이미지" /></div>}<h1>{query.status === "active" ? "공간 등록이 완료됐어요!" : "임시 저장했어요."}</h1><h2>{query.name}</h2><span className="tag">{query.status}</span><div className="meta" style={{ justifyContent: "center", marginTop: 24 }}>{query.slug && <Link className="btn btn-ghost" href={`/spaces/${query.slug}`}>등록한 공간 보기</Link>}<Link className="btn btn-primary" href="/dashboard/spaces">내 공간으로 이동</Link></div></div>{space && <SpaceAnalysisPanel spaceId={space.id} />}</div></section>;
}
