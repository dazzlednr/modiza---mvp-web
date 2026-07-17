import { SpaceRegistrationAssistant } from "@/components/space/SpaceRegistrationAssistant";
import { requireUser } from "@/lib/auth/access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getApprovedSpaceHostDefaults } from "@/repositories/adminRepository";

export default async function AssistedSpaceRegistrationPage() {
  const { user } = await requireUser("/spaces/register/with-modiza");
  const defaults = await getApprovedSpaceHostDefaults(createAdminSupabaseClient(), user.id);
  return <section className="section"><div className="container" style={{ maxWidth: 1000 }}>
    <SpaceRegistrationAssistant initialSuggested={{ address: defaults.address, useHostContact: true, preferredContactMethod: defaults.contactMethod, privateContact: defaults.contactValue }} />
  </div></section>;
}
