"use client";

import Link from "next/link";
import { CalendarDays, LayoutDashboard, Menu, UserRound, Users } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { hasRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types/profile";
import { communityCategories, categoryQueryValue } from "@/constants/taxonomy";
import { useOutsideClick } from "@/hooks/useOutsideClick";

export type HeaderUser = {
  email: string;
  nickname: string;
  roles: UserRole[];
} | null;

export function Header({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const closeCategory = useCallback(() => setCategoryOpen(false), []);
  useOutsideClick(profileRef, profileOpen, closeProfile);
  useOutsideClick(categoryRef, categoryOpen, closeCategory);
  const supportHref = user && hasRole(user, "community_host") ? "/dashboard" : "/support";
  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link className="logo" href="/">MODI<span>ZA</span></Link>
          <nav className="nav">
            <Link href="/communities">커뮤니티</Link>
            <Link href="/events">이번 주 모임</Link>
            <div className="nav-dropdown" ref={categoryRef}><button type="button" aria-expanded={categoryOpen} onClick={() => setCategoryOpen((value) => !value)}>카테고리</button>{categoryOpen && <div className="category-menu">{communityCategories.map((category) => <Link key={category} href={`/communities?category=${categoryQueryValue(category)}`} onClick={closeCategory}>{category}</Link>)}</div>}</div>
            <Link href={supportHref}>운영지원</Link>
          </nav>
          <div className="actions">
            <Link className="btn btn-ghost" href="/communities/register">커뮤니티 등록</Link>
            <Link className="btn btn-ghost" href="/spaces/register">공간 등록</Link>
            <Link className="btn btn-primary" href="/dashboard">운영 대시보드</Link>
            {user ? (
              <div style={{ position: "relative" }} ref={profileRef}>
                <button type="button" className="btn btn-ghost" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
                  <UserRound size={18} /> {user.nickname}
                </button>
                {profileOpen && (
                  <div className="panel" style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 250, maxHeight: "70vh", overflowY: "auto", padding: 16, zIndex: 80, display: "grid", gap: 10 }}>
                    <small className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</small>
                    <Link href="/mypage" onClick={() => setProfileOpen(false)}>마이페이지</Link>
                    <Link href="/mypage#profile" onClick={() => setProfileOpen(false)}>내 프로필</Link>
                    <Link href="/mypage/applications" onClick={() => setProfileOpen(false)}>내 신청 내역</Link>
                    {hasRole(user, "community_host") && <>
                      <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--border)" }} />
                      <Link href="/dashboard/communities" onClick={() => setProfileOpen(false)}>내 커뮤니티</Link>
                      <Link href="/communities/register" onClick={() => setProfileOpen(false)}>커뮤니티 만들기</Link>
                      <Link href="/dashboard" onClick={() => setProfileOpen(false)}>운영지원</Link>
                      <Link href="/dashboard/applications" onClick={() => setProfileOpen(false)}>신청자 관리</Link>
                      <Link href="/dashboard/spaces/recommend" onClick={() => setProfileOpen(false)}>공간 추천</Link>
                    </>}
                    {hasRole(user, "space_host") && <>
                      <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--border)" }} />
                      <Link href="/dashboard/spaces" onClick={() => setProfileOpen(false)}>내 공간</Link>
                      <Link href="/spaces/register" onClick={() => setProfileOpen(false)}>공간 등록</Link>
                      <Link href="/dashboard/spaces" onClick={() => setProfileOpen(false)}>공간 관리</Link>
                    </>}
                    <LogoutButton className="btn btn-ghost" />
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login">로그인</Link>
                <Link href="/signup">회원가입</Link>
              </>
            )}
          </div>
          <button type="button" aria-label="메뉴" className="mobile-toggle" onClick={() => setOpen(!open)}><Menu /></button>
        </div>
        {open && (
          <div className="container" style={{ padding: "12px 0 20px", display: "grid", gap: 12 }}>
            <Link href="/communities">커뮤니티</Link>
            <Link href="/events">이번 주 모임</Link>
            <strong>카테고리</strong><div className="mobile-category-links">{communityCategories.map((category) => <Link key={category} href={`/communities?category=${categoryQueryValue(category)}`} onClick={() => setOpen(false)}>{category}</Link>)}</div>
            <Link href={supportHref}>운영지원</Link>
            <Link href="/communities/register">커뮤니티 등록</Link>
            <Link href="/spaces/register">공간 등록</Link>
            {user ? <>
              <Link href="/mypage">마이페이지</Link>
              {hasRole(user, "community_host") && <Link href="/dashboard/communities">내 커뮤니티</Link>}
              {hasRole(user, "space_host") && <Link href="/dashboard/spaces">내 공간</Link>}
              <LogoutButton className="btn btn-ghost" />
            </> : <><Link href="/login">로그인</Link><Link href="/signup">회원가입</Link></>}
          </div>
        )}
      </header>
      <nav className="mobile-nav">
        <Link href="/"><Users /><span>홈</span></Link>
        <Link href="/communities"><Users /><span>커뮤니티</span></Link>
        <Link href="/events"><CalendarDays /><span>모임</span></Link>
        {user ? <Link href="/mypage"><UserRound /><span>내 정보</span></Link> : <Link href="/login"><UserRound /><span>로그인</span></Link>}
        <Link href="/dashboard"><LayoutDashboard /><span>운영</span></Link>
      </nav>
    </>
  );
}

export function Footer() {
  return <footer className="footer"><div className="container footer-grid"><div><div className="logo">MODI<span>ZA</span></div><p className="muted">대구의 취향과 사람을 잇는 로컬 커뮤니티</p></div><div className="meta"><Link href="/support">모디자 소개</Link><a href="#">이용약관</a><a href="#">개인정보처리방침</a><Link href="/communities/register">커뮤니티 등록</Link><Link href="/spaces/register">공간 등록</Link><a href="mailto:hello@modiza.kr">문의하기</a></div></div></footer>;
}
