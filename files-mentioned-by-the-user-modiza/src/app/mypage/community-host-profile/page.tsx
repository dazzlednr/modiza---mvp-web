import { CommunityHostProfileForm } from "@/components/community-host/CommunityHostProfileForm";
import { requireRole } from "@/lib/auth/access";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getCommunityHostProfile } from "@/repositories/communityHostProfileRepository";

export default async function Page(){
  const {user,profile}=await requireRole("community_host","/mypage/community-host-profile");
  const db=await createAuthServerSupabaseClient(); const hostProfile=await getCommunityHostProfile(db,user.id);
  const member={nickname:profile?.nickname??String(user.user_metadata?.nickname??user.email?.split("@")[0]??"회원"),profileImage:profile?.profileImage??null};
  return <section className="section"><div className="container" style={{maxWidth:760}}><p className="eyebrow">Community Host Profile</p><h1 className="section-title">커뮤니티 운영자 정보</h1><p className="muted" style={{marginBottom:24}}>닉네임과 사진은 회원 프로필에서 관리하며, 변경하면 운영자 소개에도 자동 반영됩니다.</p><CommunityHostProfileForm initial={hostProfile} member={member} redirectTo="/mypage" editing/></div></section>;
}
