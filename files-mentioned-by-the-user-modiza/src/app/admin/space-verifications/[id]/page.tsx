import Image from "next/image";
import {notFound} from "next/navigation";
import {AdminActionButton} from "@/components/admin/AdminActionButton";
import {MapViewButton} from "@/components/common/MapViewButton";
import {requireAdminDb} from "@/lib/auth/admin";
import {getSpaceVerificationRequest} from "@/repositories/adminRepository";
export const dynamic="force-dynamic";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const request=await getSpaceVerificationRequest(await requireAdminDb(),(await params).id) as any;
  if(!request)notFound();
  const space=request.spaces;const images=(space?.space_images??[]).sort((a:any,b:any)=>a.sort_order-b.sort_order);
  const address=[space?.address,space?.address_detail].filter(Boolean).join(" ");
  return <><div className="page-heading"><p className="eyebrow">Review space</p><h1>{space?.name}</h1><div className="management-actions"><span className={`tag space-status-${request.status}`}>{request.status}</span><MapViewButton address={address} placeName={space?.name}/></div></div>
    {!!images.length&&<div className="grid cards">{images.map((item:any)=><div className="card" key={item.id}><div className="cover"><Image src={item.public_url} fill alt={space.name}/></div></div>)}</div>}
    <section className="panel"><h2>공간 정보</h2><div className="detail-info-grid"><div className="detail-item"><span>공간 유형</span><strong>{space?.space_type}</strong></div><div className="detail-item"><span>주소</span><strong>{address}</strong></div><div className="detail-item"><span>최대 인원</span><strong>{space?.max_capacity}명</strong></div><div className="detail-item"><span>가격</span><strong>시간당 {Number(space?.price_per_hour??0).toLocaleString("ko-KR")}원</strong></div></div><p>{space?.description}</p></section>
    <section className="panel"><h2>신청자와 운영 권한</h2><div className="detail-info-grid"><div className="detail-item"><span>담당자</span><strong>{request.contact_name} · {request.contact_phone}</strong></div><div className="detail-item"><span>공간과의 관계</span><strong>{request.relationship_type}{request.relationship_detail?` · ${request.relationship_detail}`:""}</strong></div></div>{request.applicant_note&&<p><strong>추가 전달 사항</strong><br/>{request.applicant_note}</p>}<div className="management-actions">{(request.space_verification_files??[]).map((file:any)=><a className="btn btn-ghost btn-small" href={`/api/admin/space-verifications/${request.id}/evidence?fileId=${file.id}`} target="_blank" rel="noopener noreferrer" key={file.id}>{file.original_name}</a>)}</div></section>
    {request.status==="pending"&&<section className="panel"><h2>심사 처리</h2><p className="muted">승인하면 즉시 공개·검색·추천 대상이 됩니다. 보완 요청과 반려는 사유를 반드시 입력합니다.</p><div className="management-actions"><AdminActionButton action="space_verification_approve" targetId={request.id} label="승인"/><AdminActionButton action="space_verification_revision" targetId={request.id} label="보완 요청" requiresReason/><AdminActionButton action="space_verification_reject" targetId={request.id} label="반려" danger requiresReason/></div></section>}
    {space?.status==="approved"&&<section className="panel"><h2>승인 후 공개 관리</h2><AdminActionButton action="space_suspend" targetId={space.id} label="공개 중지" danger requiresReason/></section>}
    {space?.status==="suspended"&&<section className="panel"><h2>공개 중단 상태</h2><p className="error-summary">{space.suspension_reason}</p><AdminActionButton action="space_unsuspend" targetId={space.id} label="공개 중단 해제"/></section>}
  </>;
}
