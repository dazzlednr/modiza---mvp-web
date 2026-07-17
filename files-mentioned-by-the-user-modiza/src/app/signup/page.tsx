import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { next } = await searchParams;
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";
  if (user) redirect(destination);
  return <section className="section"><div className="container panel" style={{ maxWidth: 480 }}><AuthForm mode="signup" next={destination} /></div></section>;
}
