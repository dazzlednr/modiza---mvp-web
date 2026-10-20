import Link from "next/link";
import { CalendarDays, Link2, MapPin, Users } from "lucide-react";
import { meetingStatusLabels } from "@/lib/meeting/validation";
import type { Meeting } from "@/types/meeting";

function formatDate(value: string | null) {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(`${value}T00:00:00+09:00`));
}

export function MeetingCard({ meeting, management = false }: { meeting: Meeting; management?: boolean }) {
  const href = management ? `/dashboard/meetings/${meeting.id}/edit` : `/meetings/${meeting.slug}`;
  return <article className="card meeting-card">
    <Link href={href} aria-label={`${meeting.title} 상세 보기`} className="meeting-card-cover" style={meeting.imageUrl ? { backgroundImage: `url(${meeting.imageUrl})` } : undefined}>
      {!meeting.imageUrl && <CalendarDays aria-hidden="true" />}
      <span className={`tag meeting-status-${meeting.status}`}>{meetingStatusLabels[meeting.status]}</span>
      {meeting.visibility === "link_only" && <span className="meeting-link-only"><Link2 size={13} />링크 전용</span>}
    </Link>
    <div className="card-body meeting-card-body">
      <div className="meta"><span>{meeting.communityName ?? "독립 모임"}</span></div>
      <Link href={href}><h2>{meeting.title}</h2></Link>
      <p className="muted">{meeting.shortDescription || "모임 소개를 준비하고 있어요."}</p>
      <div className="meeting-card-meta">
        <span><CalendarDays />{formatDate(meeting.eventDate)}{meeting.startTime ? ` · ${meeting.startTime}` : ""}</span>
        <span><MapPin />{meeting.locationIsUndecided ? "장소 미정" : meeting.location || "장소 미정"}</span>
        <span><Users />{meeting.capacity ? `정원 ${meeting.capacity}명` : "정원 미정"}</span>
      </div>
    </div>
  </article>;
}
