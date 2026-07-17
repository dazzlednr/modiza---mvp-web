import { SpaceForm } from "@/components/space/SpaceForm";
import { requireUser } from "@/lib/auth/access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getApprovedSpaceHostDefaults } from "@/repositories/adminRepository";

export default async function DirectSpaceRegistrationPage() {
  const { user } = await requireUser("/spaces/register/write");
  const defaults = await getApprovedSpaceHostDefaults(createAdminSupabaseClient(), user.id);
  return <section className="section"><div className="container" style={{ maxWidth: 1000 }}>
    <p className="eyebrow">Write directly</p><h1 className="section-title">공간 직접 등록</h1><p className="muted">작성 팁을 참고해 공간 정보를 직접 채워주세요. 이 경로에서는 AI를 호출하지 않습니다.</p>
    <SpaceForm suggested={{ address: defaults.address, useHostContact: true, preferredContactMethod: defaults.contactMethod, privateContact: defaults.contactValue }} />
  </div></section>;
}
