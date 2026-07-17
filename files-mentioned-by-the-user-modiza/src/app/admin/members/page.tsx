import { AdminActionButton } from "@/components/admin/AdminActionButton";
import { requireAdminDb } from "@/lib/auth/admin";
import { getAdminMembers } from "@/repositories/adminRepository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getAdminMembers(await requireAdminDb());
  return <>
    <div className="page-heading"><p className="eyebrow">Members</p><h1>회원 관리</h1><p className="muted">계정 상태와 커뮤니티·공간 운영 권한을 관리합니다.</p></div>
    <div className="admin-list">{rows.map((member) => <article className="panel" key={member.id}>
      <div className="section-heading"><div><h2>{member.nickname}</h2><p className="muted">{member.email} / {new Date(member.createdAt).toLocaleDateString("ko-KR")}</p><div className="meta">{member.roles.map((role) => <span className="tag" key={role}>{role}</span>)}{member.communityHostRevokedAt && <span className="tag application-rejected">커뮤니티 운영 권한 회수됨</span>}</div></div><span className={`tag ${member.accountStatus === "suspended" ? "application-rejected" : "application-approved"}`}>{member.accountStatus}</span></div>
      {member.communityHostRevocationReason && <p className="field-error">커뮤니티 운영 권한 회수 사유: {member.communityHostRevocationReason}</p>}
      <div className="management-actions">
        {member.accountStatus === "active" ? <AdminActionButton action="member_suspend" targetId={member.id} label="일시 정지" danger requiresReason /> : <AdminActionButton action="member_unsuspend" targetId={member.id} label="정지 해제" />}
        {member.roles.includes("space_host") && <AdminActionButton action="member_revoke_host" targetId={member.id} label="공간 운영 권한 회수" danger requiresReason />}
        {member.roles.includes("community_host") && <AdminActionButton action="member_revoke_community_host" targetId={member.id} label="커뮤니티 운영 권한 회수" danger requiresReason />}
        {member.communityHostRevokedAt && <AdminActionButton action="member_restore_community_host" targetId={member.id} label="커뮤니티 운영 권한 복구" />}
      </div>
    </article>)}</div>
  </>;
}
