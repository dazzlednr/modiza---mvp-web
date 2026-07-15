import Link from "next/link";
import { Building2, Compass, LayoutDashboard, Users } from "lucide-react";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { requireUser } from "@/lib/auth/access";
import { getRoleLabel, hasRole, normalizeRoles } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, profile } = await requireUser("/mypage");
  const email = profile?.email ?? user.email ?? "이메일 정보 없음";
  const nickname = profile?.nickname ?? String(user.user_metadata?.nickname ?? user.email?.split("@")[0] ?? "회원");
  const profileImage = profile?.profileImage ?? (typeof user.user_metadata?.profile_image === "string" ? user.user_metadata.profile_image : null);
  const roles = normalizeRoles(profile?.roles);
  const communityHost = hasRole(profile, "community_host");
  const spaceHost = hasRole(profile, "space_host");

  return (
    <section className="section dashboard-shell">
      <div className="container" style={{ maxWidth: 1040 }}>
        <div className="section-heading page-heading">
          <div>
            <p className="eyebrow">My MODIZA</p>
            <h1 className="section-title">마이페이지</h1>
            <p className="muted">프로필을 관리하고 내 활동으로 바로 이동할 수 있어요.</p>
          </div>
          <Link className="btn btn-primary" href="/dashboard"><LayoutDashboard size={18} /> 내 대시보드</Link>
        </div>

        {!profile && <div className="error-summary">프로필 정보를 찾지 못했어요. Part 4-1 profiles Migration 실행 여부를 확인해 주세요.</div>}
        <ProfileEditor initial={{ nickname, email, bio: profile?.bio ?? "", profileImage, mainRegion: profile?.mainRegion ?? "대구 전체", detailedRegion: profile?.detailedRegion ?? "", customRegion: profile?.customRegion ?? "", interestCategories: profile?.interestCategories ?? [] }} />

        <section className="dashboard-section profile-role-section">
          <div className="section-heading">
            <div><p className="eyebrow">Roles</p><h2>내 역할과 활동</h2></div>
            <div className="meta">{roles.filter((role) => role !== "admin").map((role) => <span className="tag" key={role}>{getRoleLabel(role)}</span>)}</div>
          </div>
          <div className="profile-role-grid">
            <article className="panel role-card">
              <Compass color="var(--primary)" />
              <div><h3>일반 회원</h3><p className="muted">관심 있는 커뮤니티를 둘러보고 참여 신청 내역을 확인해요.</p></div>
              <div className="management-actions"><Link className="btn btn-ghost btn-small" href="/communities">커뮤니티 둘러보기</Link><Link className="btn btn-primary btn-small" href="/mypage/applications">내 신청</Link></div>
            </article>
            <article className="panel role-card">
              <Users color="var(--primary)" />
              <div><h3>커뮤니티 운영자</h3><p className="muted">내 커뮤니티, 신청자, 일정과 체크리스트를 관리해요.</p></div>
              {communityHost ? <Link className="btn btn-primary btn-small" href="/dashboard/communities">내 커뮤니티</Link> : <Link className="btn btn-ghost btn-small" href="/role/start?role=community_host&redirect=/dashboard/communities">커뮤니티 운영 시작하기</Link>}
            </article>
            <article className="panel role-card">
              <Building2 color="var(--primary)" />
              <div><h3>공간 운영자</h3><p className="muted">등록 공간의 공개 상태와 AI 분석 결과를 관리해요.</p></div>
              {spaceHost ? <Link className="btn btn-primary btn-small" href="/dashboard/spaces">내 공간</Link> : <Link className="btn btn-ghost btn-small" href="/role/start?role=space_host&redirect=/dashboard/spaces">공간 운영 시작하기</Link>}
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
