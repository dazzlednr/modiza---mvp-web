"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Users } from "lucide-react";
import { hasRole } from "@/lib/auth/roles";
import type { Profile } from "@/types/profile";
import type { SelfActivatableRole } from "@/lib/auth/roles";

export function RoleStartPanel({requestedRole,redirectTo,profile}:{requestedRole?:SelfActivatableRole;redirectTo:string;profile:Profile|null}){
  const router=useRouter(); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const role=requestedRole??"community_host"; const active=hasRole(profile,role);
  async function activate(){setLoading(true);setError("");try{const response=await fetch("/api/profile/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role})});const result=await response.json();if(!response.ok)throw new Error(result.message);router.replace(redirectTo);router.refresh();}catch{setError("운영자 설정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");setLoading(false);}}
  return <div className="grid" style={{gap:20}}><article className="panel" style={{display:"grid",gap:16}}><Users size={34} color="var(--primary)"/><div><h2>커뮤니티 운영을 시작하시겠어요?</h2><p className="muted">커뮤니티와 신청자, 일정, 체크리스트를 관리할 수 있어요.</p></div>{active?<Link className="btn btn-primary" href={redirectTo}>계속하기</Link>:<button type="button" className="btn btn-primary" disabled={loading} onClick={()=>void activate()}>{loading?"설정하고 있어요…":"커뮤니티 운영자로 시작하기"}</button>}</article>{error&&<p className="error-summary" role="alert">{error}</p>}<Link className="btn btn-ghost" href="/mypage">취소</Link></div>;
}
