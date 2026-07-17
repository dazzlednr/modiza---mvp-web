import { InterestOnboarding } from "@/components/profile/InterestOnboarding";
import { requireUser } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { profile } = await requireUser("/onboarding");
  return <section className="section"><div className="container" style={{ maxWidth: 760 }}><InterestOnboarding initialCategories={profile?.interestedCategories ?? []} initialRegions={profile?.interestedRegions ?? []} /></div></section>;
}
