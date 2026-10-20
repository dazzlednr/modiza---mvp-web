import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header, type HeaderUser } from "@/components/layout";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileById } from "@/repositories/profileRepository";
import type { UserRole } from "@/types/profile";

export const metadata: Metadata = {
  title: "MODIZA | 모임 운영을 더 가밍게",
  description: "독립 모임부터 커뮤니티 연결 모임까지 한곳에서 만들고 운영하세요.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAuthServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  let headerUser: HeaderUser = null;
  if (user?.email) {
    let nickname = String(user.user_metadata?.nickname ?? user.email.split("@")[0]);
    let userRoles: UserRole[] = ["member"];
    try {
      const profile = await getProfileById(supabase, user.id);
      if (profile) {
        nickname = profile.nickname;
        userRoles = profile.roles;
      }
    } catch {
      // The header still works before the profiles migration is applied.
    }
    headerUser = { id: user.id, email: user.email, nickname, roles: userRoles };
  }
  return <html lang="ko"><body><Header user={headerUser} /><main>{children}</main><Footer /></body></html>;
}
