import { CommunityCreationAssistant } from "@/components/community/CommunityCreationAssistant";
import { getCommunityRegistrationContext, registrationQueryString, type RegistrationQuery } from "@/lib/community/registration";

export default async function AssistedCommunityRegistrationPage({ searchParams }: { searchParams: Promise<RegistrationQuery> }) {
  const query = await searchParams;
  const context = await getCommunityRegistrationContext(query);
  return <section className="section"><div className="container" style={{ maxWidth: 960 }}>
    <CommunityCreationAssistant spaces={context.spaces} suggested={context.suggested} directHref={`/communities/register/write${registrationQueryString(query)}`} />
  </div></section>;
}
