"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { RegionFields } from "@/components/common/RegionFields";
import { communityCategories, PRIMARY_REGION } from "@/constants/taxonomy";
import { personalizationCategories, personalizationRegions } from "@/constants/personalization";

type InitialProfile = { nickname: string; email: string; bio: string; profileImage: string | null; mainRegion: string; detailedRegion: string; customRegion: string; interestCategories: string[]; interestedCategories?: string[]; interestedRegions?: string[] };

export function ProfileEditor({ initial }: { initial: InitialProfile }) {
  const [nickname, setNickname] = useState(initial.nickname);
  const [bio, setBio] = useState(initial.bio);
  const [region, setRegion] = useState({ mainRegion: initial.mainRegion || PRIMARY_REGION, detailedRegion: initial.detailedRegion, customRegion: initial.customRegion });
  const [interests, setInterests] = useState(initial.interestCategories);
  const [personalInterests, setPersonalInterests] = useState(initial.interestedCategories ?? []);
  const [personalRegions, setPersonalRegions] = useState(initial.interestedRegions ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(initial.profileImage);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);
  useEffect(() => {
    if (initial.interestedCategories && initial.interestedRegions) return;
    void fetch("/api/profile", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((profile) => {
      if (!profile) return;
      setPersonalInterests(profile.interestedCategories ?? []);
      setPersonalRegions(profile.interestedRegions ?? []);
    });
  }, [initial.interestedCategories, initial.interestedRegions]);

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
      form.set("interestedCategories", JSON.stringify(personalInterests));
      form.set("interestedRegions", JSON.stringify(personalRegions));
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
        <fieldset className="profile-wide"><legend>{"\uB9DE\uCDA4 \uCD94\uCC9C \uAD00\uC2EC \uD65C\uB3D9 (\uCD5C\uB300 5\uAC1C)"}</legend><div className="category-row">{personalizationCategories.map((item)=><button type="button" key={item} className={`category ${personalInterests.includes(item)?"active":""}`} onClick={()=>setPersonalInterests((current)=>current.includes(item)?current.filter((value)=>value!==item):current.length<5?[...current,item]:current)}>{item}</button>)}</div></fieldset>
        <fieldset className="profile-wide"><legend>{"\uB9DE\uCDA4 \uCD94\uCC9C \uAD00\uC2EC \uC9C0\uC5ED (\uCD5C\uB300 3\uAC1C)"}</legend><div className="category-row">{personalizationRegions.map((item)=><button type="button" key={item} className={`category ${personalRegions.includes(item)?"active":""}`} onClick={()=>setPersonalRegions((current)=>current.includes(item)?current.filter((value)=>value!==item):current.length<3?[...current,item]:current)}>{item}</button>)}</div></fieldset>
        <div className="profile-save-row"><small className={failed ? "field-error" : "muted"} role="status">{message}</small><button className="btn btn-primary" disabled={saving}>{saving ? "\uC800\uC7A5 \uC911..." : "\uD504\uB85C\uD544 \uC800\uC7A5"}</button></div>
      </div>
    </form>
  );
}
