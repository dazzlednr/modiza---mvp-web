import {AdminActionButton} from "@/components/admin/AdminActionButton";
import {requireAdminDb} from "@/lib/auth/admin";
import {getAdminSpaces} from "@/repositories/adminRepository";
export const dynamic="force-dynamic";

export default async function Page(){
  const rows=await getAdminSpaces(await requireAdminDb());
  return <><div className="page-heading"><p className="eyebrow">Spaces</p><h1>공간 공개 관리</h1><p className="muted">승인 완료 공간의 공개 중지와 복구만 처리합니다. 최초 승인은 공간 인증 관리에서 진행해주세요.</p></div><div className="admin-list">{rows.length?rows.map((space)=><article className="panel" key={space.id}><div className="section-heading"><div><span className="tag">{space.status}</span><h2>{space.name}</h2><p className="muted">{space.main_region} · {space.space_type} · {new Date(space.created_at).toLocaleDateString("ko-KR")}</p></div></div>{space.moderation_reason&&<p className="error-summary">처리 사유: {space.moderation_reason}</p>}<div className="management-actions">{space.status==="approved"&&<AdminActionButton action="space_suspend" targetId={space.id} label="공개 중지" danger requiresReason/>}{space.status==="suspended"&&<AdminActionButton action="space_unsuspend" targetId={space.id} label="공개 복구"/>}</div></article>):<div className="empty">등록된 공간이 없습니다.</div>}</div></>;
}
