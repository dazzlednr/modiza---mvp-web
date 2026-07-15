import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getMyCommunityById } from "@/repositories/communityRepository";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams; if (!id) notFound();
  const community = await getMyCommunityById(await createAuthServerSupabaseClient(), id); if (!community) notFound();
  return <section className="section"><div className="container" style={{ maxWidth: 760 }}><div className="panel"><p className="eyebrow">Registration complete</p><h1>커뮤니티 등록이 완료됐어요</h1><div className="cover" style={{ margin: "24px 0" }}><Image src={community.thumbnailUrl} alt={community.name} fill /></div><h2>{community.name}</h2><p className="tag">{community.status === "published" ? community.recruitmentStatus : "임시 저장"}</p><p>다음 모임: {community.nextMeetingAt ? new Date(community.nextMeetingAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "미정"}</p><div className="meta"><Link className="btn btn-primary" href={`/communities/${community.slug}`}>커뮤니티 보기</Link><Link className="btn btn-ghost" href="/dashboard/communities">내 커뮤니티로 이동</Link></div></div></div></section>;
}
