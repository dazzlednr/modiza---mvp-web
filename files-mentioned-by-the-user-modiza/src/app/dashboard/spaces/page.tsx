"use client";
import Image from "next/image";
import Link from "next/link";
import {useEffect,useState} from "react";
import {Building2,Eye,EyeOff,Pencil,RotateCcw,Trash2,XCircle} from "lucide-react";
import type {Space,SpaceStatus} from "@/types/space";

const labels:Record<SpaceStatus,string>={draft:"작성 중",pending:"심사 중",revision_requested:"보완 요청",approved:"승인·공개 중",rejected:"반려",suspended:"관리자 공개 중지",inactive:"운영 중지"};
const descriptions:Record<SpaceStatus,string>={draft:"정보와 증빙자료를 완성한 뒤 공간 인증을 신청해주세요.",pending:"관리자가 공간 정보와 운영 권한 증빙을 확인하고 있어요.",revision_requested:"관리자의 보완 요청을 확인하고 수정한 뒤 다시 제출해주세요.",approved:"인증이 완료되어 이용자에게 공개되고 추천에 사용됩니다.",rejected:"반려 사유를 확인하고 정보를 보완해 다시 신청할 수 있어요.",suspended:"관리자 조치로 공개와 추천이 중지되었습니다.",inactive:"운영자가 공개를 잠시 중지한 공간입니다."};

export default function Page(){
  const[items,setItems]=useState<Space[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
  async function load(){try{const response=await fetch("/api/spaces",{cache:"no-store"});if(!response.ok)throw new Error();setItems(await response.json());}catch{setError("공간 목록을 불러오지 못했어요.");}finally{setLoading(false);}}
  useEffect(()=>{const controller=new AbortController();fetch("/api/spaces",{cache:"no-store",signal:controller.signal}).then((response)=>{if(!response.ok)throw new Error();return response.json() as Promise<Space[]>;}).then(setItems).catch((caught:unknown)=>{if(!(caught instanceof DOMException&&caught.name==="AbortError"))setError("공간 목록을 불러오지 못했어요.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[]);
  async function action(id:string,next:"cancel_verification"|"deactivate"|"reactivate"){if(next==="cancel_verification"&&!confirm("진행 중인 인증 신청을 취소할까요?"))return;const response=await fetch(`/api/spaces/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:next})});if(!response.ok)return setError((await response.json()).message);await load();}
  async function remove(id:string){if(!confirm("작성 중인 공간과 등록 이미지를 삭제할까요?"))return;const response=await fetch(`/api/spaces/${id}`,{method:"DELETE"});if(!response.ok)return setError((await response.json()).message);await load();}
  if(loading)return <section className="section"><div className="container">내 공간을 불러오는 중...</div></section>;
  return <section className="section dashboard-shell"><div className="container"><div className="section-heading page-heading"><div><p className="eyebrow">My spaces</p><h1 className="section-title">내 공간</h1><p className="muted">공간별 인증 상태와 공개 여부를 확인하고 필요한 작업을 이어가세요.</p></div><div className="management-actions"><Link className="btn btn-ghost" href="/dashboard/spaces/requests">이용 요청 관리</Link><Link className="btn btn-primary" href="/spaces/register">새 공간 등록</Link></div></div>{error&&<p className="error-summary">{error}</p>}
    {items.length?<div className="management-list">{items.map((space)=>{const request=space.latestVerification;const reason=request?.revisionRequestReason||request?.rejectionReason||space.suspensionReason;return <article className="management-card" key={space.id}><div className="management-thumb">{space.thumbnailUrl?<Image src={space.thumbnailUrl} fill alt={space.name}/>:<div className="empty compact">이미지 없음</div>}</div><div className="management-content"><div className="section-heading"><div><span className={`tag space-status-${space.status}`}>{labels[space.status]}</span><h2>{space.name}</h2></div><small className="muted">최근 수정 {new Date(space.updatedAt).toLocaleDateString("ko-KR")}</small></div><p>{descriptions[space.status]}</p>{reason&&<p className="error-summary"><strong>처리 사유</strong><br/>{reason}</p>}<p className="muted">{space.mainRegion} · 시간당 {space.pricePerHour.toLocaleString("ko-KR")}원 · 최대 {space.maxCapacity}명</p><p className="muted">{[space.address,space.addressDetail].filter(Boolean).join(" ")}{space.latestVerification?.submittedAt&&` · 신청 ${new Date(space.latestVerification.submittedAt).toLocaleDateString("ko-KR")}`}{space.approvedAt&&` · 승인 ${new Date(space.approvedAt).toLocaleDateString("ko-KR")}`}</p><div className="management-actions">
      {space.status==="approved"&&<Link className="btn btn-ghost btn-small" href={`/spaces/${space.slug}`}><Eye/>공개 화면</Link>}
      {space.status!=="pending"&&space.status!=="suspended"&&<Link className="btn btn-ghost btn-small" href={`/dashboard/spaces/${space.id}/edit`}><Pencil/>{["revision_requested","rejected"].includes(space.status)?"보완 후 다시 제출":"수정"}</Link>}
      {space.status==="pending"&&<button className="btn btn-ghost btn-small" onClick={()=>void action(space.id,"cancel_verification")}><XCircle/>신청 취소</button>}
      {space.status==="approved"&&<button className="btn btn-ghost btn-small" onClick={()=>void action(space.id,"deactivate")}><EyeOff/>운영 중지</button>}
      {space.status==="inactive"&&<button className="btn btn-ghost btn-small" onClick={()=>void action(space.id,"reactivate")}><RotateCcw/>다시 공개</button>}
      {["draft","revision_requested","rejected"].includes(space.status)&&<button className="btn btn-ghost btn-small" onClick={()=>void remove(space.id)}><Trash2/>삭제</button>}
    </div></div></article>;})}</div>:<div className="empty"><Building2 size={40}/><h3>등록한 공간이 없습니다.</h3><p className="muted">공간 운영자 자격 승인 후 각 공간의 인증을 신청할 수 있어요.</p><Link className="btn btn-primary" href="/spaces/register">공간 등록하기</Link></div>}
  </div></section>;
}
