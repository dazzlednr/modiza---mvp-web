"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { RegionFields } from "@/components/common/RegionFields";
import { communityCategories, PRIMARY_REGION } from "@/constants/taxonomy";

type Mode = "login" | "signup" | "forgot" | "update-password";

const errorMessage = (message: string) => {
  if (message.includes("Invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (message.includes("User already registered"))
    return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (message.toLowerCase().includes("password"))
    return "비밀번호는 8자 이상으로 입력해 주세요.";
  if (message.toLowerCase().includes("rate limit"))
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
};

const safeNext = (value?: string) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/mypage";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [memberType, setMemberType] = useState<"community_host" | "member">("member");
  const [region, setRegion] = useState({ mainRegion: PRIMARY_REGION as string, detailedRegion: "", customRegion: "" });
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");

    if ((mode === "signup" || mode === "update-password") && password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if ((mode === "signup" || mode === "update-password") && password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }
    if (mode === "signup" && nickname.trim().length < 2) {
      setError("닉네임은 2자 이상으로 입력해 주세요.");
      return;
    }
    if (mode === "signup" && (!region.detailedRegion || (region.detailedRegion === "기타" && !region.customRegion.trim()))) { setError("거주 지역을 선택해 주세요."); return; }
    if (mode === "signup" && interests.length < 1) { setError("관심 카테고리를 1개 이상 선택해 주세요."); return; }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        router.replace(safeNext(next));
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { nickname: nickname.trim(), member_type: memberType, main_region: region.mainRegion, detailed_region: region.detailedRegion, custom_region: region.detailedRegion === "기타" ? region.customRegion.trim() : null, interest_categories: interests },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
          },
        });
        if (authError) throw authError;
        if (data.user && data.user.identities?.length === 0) {
          setError("이미 가입된 이메일이에요. 로그인해 주세요.");
          return;
        }
        if (data.session) {
          router.replace(safeNext(next));
          router.refresh();
        } else {
          setNotice("가입 확인 메일을 보냈어요. 이메일의 확인 링크를 눌러 가입을 완료해 주세요.");
        }
        return;
      }

      if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` },
        );
        if (authError) throw authError;
        setNotice("비밀번호 재설정 메일을 보냈어요. 이메일을 확인해 주세요.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setNotice("비밀번호가 변경됐어요. 새 비밀번호로 로그인해 주세요.");
      await supabase.auth.signOut();
      window.setTimeout(() => router.replace("/login"), 900);
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login"
    ? "로그인"
    : mode === "signup"
      ? "회원가입"
      : mode === "forgot"
        ? "비밀번호 재설정"
        : "새 비밀번호 설정";

  return (
    <form className="form" onSubmit={submit}>
      <div>
        <p className="eyebrow">MODIZA account</p>
        <h1>{title}</h1>
      </div>
      {mode === "signup" && (
        <label>
          닉네임
          <input className="field" required minLength={2} maxLength={30} autoComplete="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} />
        </label>
      )}
      {mode === "signup" && <>
        <fieldset><legend>회원 유형</legend><div className="signup-role-grid"><button type="button" className={`category ${memberType === "member" ? "active" : ""}`} onClick={() => setMemberType("member")}>일반 참여자</button><button type="button" className={`category ${memberType === "community_host" ? "active" : ""}`} onClick={() => setMemberType("community_host")}>커뮤니티 운영자</button></div></fieldset>
        <fieldset><legend>거주 지역</legend><RegionFields {...region} onChange={setRegion} /></fieldset>
        <fieldset><legend>관심 카테고리 · 1개 이상</legend><div className="category-row">{communityCategories.map((category) => <button type="button" key={category} className={`category ${interests.includes(category) ? "active" : ""}`} onClick={() => setInterests((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}>{category}</button>)}</div></fieldset>
      </>}
      {mode !== "update-password" && (
        <label>
          이메일
          <input className="field" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
      )}
      {mode !== "forgot" && (
        <label>
          비밀번호
          <input className="field" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
      )}
      {(mode === "signup" || mode === "update-password") && (
        <label>
          비밀번호 확인
          <input className="field" type="password" required minLength={8} autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} />
        </label>
      )}
      {error && <p className="error-summary" role="alert">{error}</p>}
      {notice && <p style={{ color: "var(--success)" }} role="status">{notice}</p>}
      <button className="btn btn-primary" disabled={loading}>
        {loading ? "처리하고 있어요." : title}
      </button>
      {mode === "login" && (
        <div className="meta" style={{ justifyContent: "space-between" }}>
          <Link href="/forgot-password">비밀번호를 잊으셨나요?</Link>
          <Link href={next ? `/signup?next=${encodeURIComponent(safeNext(next))}` : "/signup"}>처음이신가요? 회원가입</Link>
        </div>
      )}
      {mode === "signup" && <Link href={next ? `/login?next=${encodeURIComponent(safeNext(next))}` : "/login"}>이미 가입하셨나요? 로그인</Link>}
      {mode === "forgot" && <Link href="/login">로그인으로 돌아가기</Link>}
    </form>
  );
}
