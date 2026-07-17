import { SpaceUseRequestList } from "@/components/space/SpaceUseRequestList";

export default function CommunitySpaceRequestsPage() {
  return <section className="section dashboard-shell"><div className="container">
    <div className="page-heading"><p className="eyebrow">My space requests</p><h1 className="section-title">보낸 공간 이용 요청</h1><p className="muted">공간 운영자의 검토 상태와 메모를 확인하고, 공간에 등록된 연락 수단으로 필요한 일정을 조율하세요.</p></div>
    <SpaceUseRequestList scope="requested" />
  </div></section>;
}
