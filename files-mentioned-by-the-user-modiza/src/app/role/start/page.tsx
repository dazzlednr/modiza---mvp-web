import { redirect } from "next/navigation";
import { RoleStartPanel } from "@/components/auth/RoleStartPanel";
import { requireUser } from "@/lib/auth/access";
import { hasRole, isSelfActivatableRole } from "@/lib/auth/roles";
import { safeInternalPath } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; redirect?: string }>;
}) {
  const query = await searchParams;
  if (!query.role || query.role === "community_host") {
    const next = safeInternalPath(query.redirect, "/communities/register");
    redirect(`/community-host/start?redirect=${encodeURIComponent(next)}`);
  }
  if (query.role === "space_host") {
    const next = safeInternalPath(query.redirect, "/dashboard/spaces");
    redirect(`/space-host/apply?redirect=${encodeURIComponent(next)}`);
  }
  const requestedRole = isSelfActivatableRole(query.role) ? query.role : undefined;
  const redirectTo = safeInternalPath(query.redirect, "/dashboard");
  const currentPath = `/role/start?${new URLSearchParams({
    ...(requestedRole && { role: requestedRole }),
    redirect: redirectTo,
  }).toString()}`;
  const { profile } = await requireUser(currentPath);
  if (requestedRole && hasRole(profile, requestedRole)) redirect(redirectTo);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Start with MODIZA</p>
        <h1 className="section-title">같은 계정으로 바로 시작할 수 있어요.</h1>
        <p className="muted" style={{ marginBottom: 28 }}>
          별도 가입이나 승인 절차 없이 필요한 운영자 역할만 추가합니다.
        </p>
        <RoleStartPanel requestedRole={requestedRole} redirectTo={redirectTo} profile={profile} />
      </div>
    </section>
  );
}
