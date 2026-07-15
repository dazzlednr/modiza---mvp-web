"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { RegionFields } from "@/components/common/RegionFields";
import { communityCategories, PRIMARY_REGION } from "@/constants/taxonomy";

type InitialProfile = { nickname: string; email: string; bio: string; profileImage: string | null; mainRegion: string; detailedRegion: string; customRegion: string; interestCategories: string[] };

export function ProfileEditor({ initial }: { initial: InitialProfile }) {
  const [nickname, setNickname] = useState(initial.nickname);
  const [bio, setBio] = useState(initial.bio);
  const [region, setRegion] = useState({ mainRegion: initial.mainRegion || PRIMARY_REGION, detailedRegion: initial.detailedRegion, customRegion: initial.customRegion });
  const [interests, setInterests] = useState(initial.interestCategories);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(initial.profileImage);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  function selectPhoto(next: File | null) {
    setFile(next);
    if (!next) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(next);
    setObjectUrl(url);
    setPreview(url);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const form = new FormData();
      form.set("nickname", nickname);
      form.set("bio", bio);
      form.set("mainRegion", region.mainRegion);
      form.set("detailedRegion", region.detailedRegion);
      form.set("customRegion", region.customRegion);
      form.set("interestCategories", JSON.stringify(interests));
      if (file) form.set("profileImage", file);
      const response = await fetch("/api/profile", { method: "PUT", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "프로필을 저장하지 못했어요.");
      setPreview(result.profileImage);
      setFile(null);
      setMessage("프로필을 저장했어요.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "프로필을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id="profile" className="panel profile-editor" onSubmit={save}>
      <div className="profile-photo">
        {preview ? <Image src={preview} fill alt="프로필 사진" unoptimized={preview.startsWith("blob:")} /> : <span>{nickname.slice(0, 1).toUpperCase()}</span>}
        <label aria-label="프로필 사진 변경"><Camera size={18} /><input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} /></label>
      </div>
      <div className="profile-fields">
        <label>닉네임<input className="field" value={nickname} maxLength={40} required onChange={(event) => setNickname(event.target.value)} /></label>
        <label>이메일<input className="field" value={initial.email} disabled /></label>
        <label>소개<textarea className="field" rows={4} maxLength={300} placeholder="나를 소개해 주세요." value={bio} onChange={(event) => setBio(event.target.value)} /></label>
        <div className="profile-wide"><RegionFields {...region} onChange={setRegion} /></div>
        <fieldset className="profile-wide"><legend>관심 카테고리 · 1개 이상</legend><div className="category-row">{communityCategories.map((category) => <button type="button" key={category} className={`category ${interests.includes(category) ? "active" : ""}`} onClick={() => setInterests((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}>{category}</button>)}</div></fieldset>
        <div className="profile-save-row"><small className={failed ? "field-error" : "muted"} role="status">{message}</small><button className="btn btn-primary" disabled={saving}>{saving ? "저장 중..." : "프로필 저장"}</button></div>
      </div>
    </form>
  );
}
