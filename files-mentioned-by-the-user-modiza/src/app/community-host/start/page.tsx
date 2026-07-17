import { redirect } from "next/navigation";
import { CommunityHostProfileForm } from "@/components/community-host/CommunityHostProfileForm";
import { requireUser } from "@/lib/auth/access";
import { hasRole } from "@/lib/auth/roles";
import { safeInternalPath } from "@/lib/auth/redirect";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getCommunityHostProfile } from "@/repositories/communityHostProfileRepository";

export default async function Page({searchParams}:{searchParams:Promise<{redirect?:string}>}){
  const query=await searchParams; const next=safeInternalPath(query.redirect,"/communities/register");
  const {user,profile}=await requireUser(`/community-host/start?redirect=${encodeURIComponent(next)}`);
  const db=await createAuthServerSupabaseClient(); const existing=await getCommunityHostProfile(db,user.id).catch(()=>null);
  if(existing&&hasRole(profile,"community_host"))redirect(next);
  if(profile?.communityHostRevokedAt)return <section className="section"><div className="container" style={{maxWidth:720}}><div className="panel"><p className="eyebrow">Community Host</p><h1>커뮤니티 운영 권한이 회수되었습니다.</h1><p className="muted">관리자가 다시 권한을 허용하기 전까지 커뮤니티 운영을 시작할 수 없습니다.</p>{profile.communityHostRevocationReason&&<p className="field-error">사유: {profile.communityHostRevocationReason}</p>}</div></div></section>;
  const member={nickname:profile?.nickname??String(user.user_metadata?.nickname??user.email?.split("@")[0]??"회원"),profileImage:profile?.profileImage??null};
  return <section className="section"><div className="container" style={{maxWidth:760}}><p className="eyebrow">Community Host</p><h1 className="section-title">커뮤니티 운영을 시작해볼까요?</h1><p className="muted" style={{marginBottom:24}}>현재 회원 계정은 그대로 유지됩니다. 운영에 필요한 소개만 추가하면 바로 커뮤니티를 만들 수 있어요.</p><CommunityHostProfileForm initial={existing} member={member} redirectTo={next}/></div></section>;
}
