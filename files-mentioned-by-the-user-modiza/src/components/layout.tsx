"use client";

import Link from "next/link";
import { ChevronDown, Menu, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { hasRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types/profile";

export type HeaderUser = {
  id: string;
  email: string;
  nickname: string;
  roles: UserRole[];
} | null;

type HeaderLinkProps = {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
};

function HeaderLink({ href, active, children, onClick }: HeaderLinkProps) {
  return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={href} onClick={onClick}>{children}</Link>;
}

export function Header({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const closeProfile = useCallback(() => {
    setProfileOpen(false);
  }, []);
  useOutsideClick(profileRef, profileOpen, closeProfile);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const communityActive = pathname === "/communities" || pathname.startsWith("/communities/");
  const eventsActive = pathname === "/events" || pathname.startsWith("/events/");
  const favoritesActive = pathname === "/mypage/favorites";
  const communityHost = user ? hasRole(user, "community_host") : false;
  const spaceHost = user ? hasRole(user, "space_host") : false;

  function openProfileWithKeyboard(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setProfileOpen(true);
    requestAnimationFrame(() => {
      profileMenuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    });
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link className="logo" href="/" aria-label="MODIZA 홈">MODI<span>ZA</span></Link>
        <nav className="nav desktop-nav" aria-label="주요 탐색">
          <HeaderLink href="/communities" active={communityActive}>커뮤니티</HeaderLink>
          <HeaderLink href="/events" active={eventsActive}>이번 주 모임</HeaderLink>
          <HeaderLink href="/mypage/favorites" active={favoritesActive}>관심 커뮤니티</HeaderLink>
        </nav>

        <div className="actions">
          <Link className="btn btn-ghost header-action" href="/communities/register">커뮤니티 등록</Link>
          <Link className="btn btn-ghost header-action" href="/spaces/register">공간 등록</Link>
          {user ? (
            <>
              <NotificationBell key={`desktop-${user.id}`} userId={user.id} />
              <Link className="btn btn-primary header-activity" href="/dashboard?view=member">내 활동</Link>
              <div className="profile-menu-wrap" ref={profileRef}>
                <button
                  ref={profileButtonRef}
                  type="button"
                  className="profile-trigger"
                  aria-label={`${user.nickname} 프로필 메뉴`}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((value) => !value)}
                  onKeyDown={openProfileWithKeyboard}
                >
                  <UserRound aria-hidden="true" />
                  <span>{user.nickname}</span>
                  <ChevronDown className={profileOpen ? "rotated" : ""} aria-hidden="true" />
                </button>
                {profileOpen && (
                  <div className="profile-dropdown" role="menu" ref={profileMenuRef} onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeProfile();
                      profileButtonRef.current?.focus();
                    }
                  }}>
                    <div className="profile-dropdown-user">
                      <strong>{user.nickname}님</strong>
                      <small>{user.email}</small>
                    </div>
                    <div className="profile-dropdown-group">
                      <Link role="menuitem" href="/mypage" onClick={closeProfile}>마이페이지</Link>
                      <Link role="menuitem" href="/mypage/applications" onClick={closeProfile}>내 신청 내역</Link>
                    </div>
                    {communityHost && (
                      <div className="profile-dropdown-group">
                        <strong className="profile-dropdown-label">커뮤니티 운영</strong>
                        <Link role="menuitem" href="/dashboard?view=community" onClick={closeProfile}>내 커뮤니티</Link>
                        <Link role="menuitem" href="/dashboard/applications" onClick={closeProfile}>신청자 관리</Link>
                      </div>
                    )}
                    {spaceHost && (
                      <div className="profile-dropdown-group">
                        <strong className="profile-dropdown-label">공간 운영</strong>
                        <Link role="menuitem" href="/dashboard?view=space" onClick={closeProfile}>내 공간</Link>
                        <Link role="menuitem" href="/dashboard/spaces/requests" onClick={closeProfile}>이용 요청 관리</Link>
                      </div>
                    )}
                    {hasRole(user, "admin") && (
                      <div className="profile-dropdown-group">
                        <Link role="menuitem" href="/admin" onClick={closeProfile}>관리자 페이지</Link>
                      </div>
                    )}
                    <div className="profile-dropdown-group profile-dropdown-account">
                      <LogoutButton className="profile-logout" onBeforeLogout={closeProfile} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link className="header-auth-link" href="/login">로그인</Link>
              <Link className="btn btn-primary header-action" href="/signup">회원가입</Link>
            </>
          )}
        </div>

        {user && <div className="mobile-notification"><NotificationBell key={`mobile-${user.id}`} userId={user.id} /></div>}
        <button
          type="button"
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-header-menu"
          className="mobile-toggle"
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileOpen && (
        <nav id="mobile-header-menu" className="mobile-menu" aria-label="모바일 메뉴">
          <div className="container mobile-menu-inner">
            <section>
              <strong>탐색</strong>
              <HeaderLink href="/communities" active={communityActive} onClick={closeMobile}>커뮤니티</HeaderLink>
              <HeaderLink href="/events" active={eventsActive} onClick={closeMobile}>이번 주 모임</HeaderLink>
              <HeaderLink href="/mypage/favorites" active={favoritesActive} onClick={closeMobile}>관심 커뮤니티</HeaderLink>
            </section>
            <section>
              <strong>등록</strong>
              <Link href="/communities/register" onClick={closeMobile}>커뮤니티 등록</Link>
              <Link href="/spaces/register" onClick={closeMobile}>공간 등록</Link>
            </section>
            {user ? (
              <>
                <section>
                  <strong>내 메뉴</strong>
                  <Link href="/dashboard?view=member" onClick={closeMobile}>내 활동</Link>
                  <Link href="/mypage" onClick={closeMobile}>마이페이지</Link>
                  <Link href="/mypage/applications" onClick={closeMobile}>내 신청 내역</Link>
                </section>
                {communityHost && (
                  <section>
                    <strong>커뮤니티 운영</strong>
                    <Link href="/dashboard?view=community" onClick={closeMobile}>내 커뮤니티</Link>
                    <Link href="/dashboard/applications" onClick={closeMobile}>신청자 관리</Link>
                  </section>
                )}
                {spaceHost && (
                  <section>
                    <strong>공간 운영</strong>
                    <Link href="/dashboard?view=space" onClick={closeMobile}>내 공간</Link>
                    <Link href="/dashboard/spaces/requests" onClick={closeMobile}>이용 요청 관리</Link>
                  </section>
                )}
                {hasRole(user, "admin") && (
                  <section>
                    <strong>관리</strong>
                    <Link href="/admin" onClick={closeMobile}>관리자 페이지</Link>
                  </section>
                )}
                <section>
                  <strong>계정</strong>
                  <LogoutButton className="mobile-logout" onBeforeLogout={closeMobile} />
                </section>
              </>
            ) : (
              <section>
                <strong>계정</strong>
                <Link href="/login" onClick={closeMobile}>로그인</Link>
                <Link href="/signup" onClick={closeMobile}>회원가입</Link>
              </section>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return <footer className="footer"><div className="container footer-grid"><div><div className="logo">MODI<span>ZA</span></div><p className="muted">대구의 취향과 사람을 잇는 로컬 커뮤니티</p></div><div className="meta"><Link href="/support">모디자 소개</Link><a href="#">이용약관</a><a href="#">개인정보처리방침</a><Link href="/communities/register">커뮤니티 등록</Link><Link href="/spaces/register">공간 등록</Link><a href="mailto:hello@modiza.kr">문의하기</a></div></div></footer>;
}
