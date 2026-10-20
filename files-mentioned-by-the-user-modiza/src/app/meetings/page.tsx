import Link from "next/link";
import { Plus } from "lucide-react";
import { MeetingCard } from "@/components/meeting/MeetingCard";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { listPublicMeetings } from "@/repositories/meetingRepository";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const db = await createAuthServerSupabaseClient();
  const meetings = await listPublicMeetings(db);
  return <section className="section meeting-explore"><div className="container">
    <div className="section-heading page-heading"><div><p className="eyebrow">Explore meetings</p><h1 className="section-title">지금 참여할 수 있는 모임</h1><p className="muted">커뮤니티에 가입하지 않아도, 관심 있는 개별 모임부터 발견해보세요.</p></div><Link className="btn btn-primary" href="/communities/register"><Plus />새 모임 만들기</Link></div>
    {meetings.length ? <div className="meeting-card-grid">{meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}</div> : <div className="empty"><h2>공개된 모임을 준비하고 있어요.</h2><p className="muted">운영자가 모집을 시작한 탐색 공개 모임이 이곳에 표시됩니다.</p></div>}
  </div></section>;
}
