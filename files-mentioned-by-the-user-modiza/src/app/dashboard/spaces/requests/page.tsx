import Link from "next/link";
import { SpaceUseRequestList } from "@/components/space/SpaceUseRequestList";

export default function SpaceOwnerRequestsPage() {
  return <section className="section dashboard-shell"><div className="container">
    <nav className="dashboard-role-tabs" aria-label="공간 운영 관리"><Link href="/dashboard/spaces">내 공간</Link><Link className="active" href="/dashboard/spaces/requests">이용 요청 관리</Link><Link href="/dashboard/spaces/reservations">예약 관리</Link></nav>
    <div className="page-heading"><p className="eyebrow">Space requests</p><h1 className="section-title">공간 이용 요청</h1><p className="muted">내 공간으로 들어온 요청을 확인하고 승인하거나 거절할 수 있습니다.</p></div>
    <SpaceUseRequestList scope="owned" />
  </div></section>;
}
