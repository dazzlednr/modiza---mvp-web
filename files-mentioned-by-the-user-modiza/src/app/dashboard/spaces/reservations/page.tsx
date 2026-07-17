import Link from "next/link";
import { SpaceUseRequestList } from "@/components/space/SpaceUseRequestList";

export default function SpaceReservationsPage() {
  return <section className="section dashboard-shell"><div className="container">
    <nav className="dashboard-role-tabs" aria-label="공간 운영 관리"><Link href="/dashboard/spaces">내 공간</Link><Link href="/dashboard/spaces/requests">이용 요청 관리</Link><Link className="active" href="/dashboard/spaces/reservations">예약 관리</Link></nav>
    <div className="page-heading"><p className="eyebrow">Reservations</p><h1 className="section-title">예약 관리</h1><p className="muted">공간 운영자가 승인해 확정된 예약 일정과 커뮤니티 정보를 확인합니다.</p></div>
    <SpaceUseRequestList scope="owned" initialStatus="confirmed" />
  </div></section>;
}
