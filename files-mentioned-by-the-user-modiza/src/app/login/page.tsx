import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { next } = await searchParams;
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/mypage");
  return <section className="section"><div className="container panel" style={{ maxWidth: 480 }}><AuthForm mode="login" next={next} /></div></section>;
}
