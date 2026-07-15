import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <section className="section"><div className="container panel" style={{ maxWidth: 480 }}><AuthForm mode="update-password" /></div></section>;
}
