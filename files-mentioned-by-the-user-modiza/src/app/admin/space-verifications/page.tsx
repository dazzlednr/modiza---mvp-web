import Link from "next/link";
import {requireAdminDb} from "@/lib/auth/admin";
import {getSpaceVerificationRequests} from "@/repositories/adminRepository";
export const dynamic="force-dynamic";

const filters=[["pending","심사 대기"],["revision_requested","보완 요청"],["approved","승인"],["rejected","반려"],["suspended","공개 중단"],["cancelled","취소"],["all","전체"]];
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}){
  const status=(await searchParams).status||"pending";
  const rows=await getSpaceVerificationRequests(await requireAdminDb(),status);
  return <><div className="section-heading page-heading"><div><p className="eyebrow">Space verification</p><h1>공간 인증 관리</h1><p className="muted">공간 운영자 자격과 별도로, 등록된 공간마다 운영 권한과 공개 적합성을 확인합니다.</p></div><div className="management-actions">{filters.map(([value,label])=><Link className={`btn btn-small ${status===value?"btn-primary":"btn-ghost"}`} href={`/admin/space-verifications?status=${value}`} key={value}>{label}</Link>)}</div></div><div className="admin-list">{rows.length?rows.map((row:any)=><article className="panel" key={row.id}><div className="section-heading"><div><span className={`tag space-status-${row.spaces?.status??row.status}`}>{row.spaces?.status??row.status}</span><h2>{row.spaces?.name??"삭제된 공간"}</h2><p className="muted">{row.spaces?.address} {row.spaces?.address_detail} · {row.relationship_type} · {new Date(row.submitted_at).toLocaleString("ko-KR")}</p></div><Link className="btn btn-ghost btn-small" href={`/admin/space-verifications/${row.id}`}>심사 상세</Link></div></article>):<div className="empty">해당 상태의 공간 인증 신청이 없습니다.</div>}</div></>;
}
