"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Users } from "lucide-react";
import { hasRole } from "@/lib/auth/roles";
import type { Profile } from "@/types/profile";
import type { SelfActivatableRole } from "@/lib/auth/roles";

const content = {
  community_host: {
    icon: Users,
    title: "커뮤니티 운영을 시작하시겠어요?",
    description: "커뮤니티를 만들고 참가 신청, 일정, 체크리스트와 공간 추천 기능을 이용할 수 있어요.",
    button: "운영자로 시작하기",
  },
  space_host: {
    icon: Building2,
    title: "공간 운영을 시작하시겠어요?",
    description: "공간을 등록하고 사진 분석 AI를 이용해 지역 커뮤니티와 연결할 수 있어요.",
    button: "공간 운영자로 시작하기",
  },
};

export function RoleStartPanel({
  requestedRole,
  redirectTo,
  profile,
}: {
  requestedRole?: SelfActivatableRole;
  redirectTo: string;
  profile: Profile | null;
}) {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<SelfActivatableRole | null>(null);
  const [error, setError] = useState("");
  const roles: SelfActivatableRole[] = requestedRole
    ? [requestedRole]
    : ["community_host", "space_host"];

  async function activate(role: SelfActivatableRole) {
    if (loadingRole) return;
    setLoadingRole(role);
    setError("");
    try {
      const response = await fetch("/api/profile/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("운영자 설정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setLoadingRole(null);
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      {roles.map((role) => {
        const item = content[role];
        const Icon = item.icon;
        const active = hasRole(profile, role);
        return (
          <article className="panel" key={role} style={{ display: "grid", gap: 16 }}>
            <Icon size={34} color="var(--primary)" />
            <div><h2>{item.title}</h2><p className="muted">{item.description}</p></div>
            {active ? (
              <Link className="btn btn-primary" href={redirectTo}>이미 활성화됨 · 계속하기</Link>
            ) : (
              <button type="button" className="btn btn-primary" disabled={Boolean(loadingRole)} onClick={() => void activate(role)}>
                {loadingRole === role ? "역할을 설정하고 있어요." : item.button}
              </button>
            )}
          </article>
        );
      })}
      {error && <p className="error-summary" role="alert">{error}</p>}
      <Link className="btn btn-ghost" href="/mypage">취소</Link>
    </div>
  );
}
