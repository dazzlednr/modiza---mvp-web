import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header, type HeaderUser } from "@/components/layout";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileById } from "@/repositories/profileRepository";
import type { UserRole } from "@/types/profile";

export const metadata: Metadata = {
  title: "MODIZA | 대구 로컬 커뮤니티",
  description: "취향이 맞는 사람들과 우리만의 모임을 시작해보세요.",
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
    headerUser = { email: user.email, nickname, roles: userRoles };
  }
  return <html lang="ko"><body><Header user={headerUser} /><main>{children}</main><Footer /></body></html>;
}
