"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { communityCategories } from "@/constants/taxonomy";
import { personalizationRegions } from "@/constants/personalization";

type MemberTasteSettingsProps = {
  initialCategories: string[];
  initialRegions: string[];
};

export function MemberTasteSettings({ initialCategories, initialRegions }: MemberTasteSettingsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState(initialCategories.slice(0, 5));
  const [regions, setRegions] = useState(initialRegions.slice(0, 3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(value: string, values: string[], limit: number, setValues: (next: string[]) => void) {
    setError("");
    if (values.includes(value)) setValues(values.filter((item) => item !== value));
    else if (values.length < limit) setValues([...values, value]);
    else setError(`최대 ${limit}개까지 선택할 수 있어요.`);
  }

  function cancel() {
    setCategories(initialCategories.slice(0, 5));
    setRegions(initialRegions.slice(0, 3));
    setError("");
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, regions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "취향 설정을 저장하지 못했어요.");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "취향 설정을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="panel member-sidebar-panel member-taste-settings">
    <div className="section-heading"><div><p className="eyebrow">My taste</p><h2>내 취향 설정</h2></div>{!editing && <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(true)}><Pencil />수정</button>}</div>
    {!editing ? <div className="member-taste-summary">
      <div><span>관심사</span><p>{categories.length ? categories.map((item) => <b className="tag" key={item}>{item}</b>) : "아직 설정하지 않았어요."}</p></div>
      <div><span>활동 지역</span><p>{regions.length ? regions.map((item) => <b className="tag" key={item}>{item}</b>) : "아직 설정하지 않았어요."}</p></div>
    </div> : <div className="member-taste-editor">
      <fieldset><legend>관심사 <small>최대 5개</small></legend><div className="member-taste-options">{communityCategories.map((item) => <button type="button" className={categories.includes(item) ? "active" : ""} key={item} onClick={() => toggle(item, categories, 5, setCategories)}>{categories.includes(item) && <Check />}{item}</button>)}</div></fieldset>
      <fieldset><legend>활동 지역 <small>최대 3개</small></legend><div className="member-taste-options">{personalizationRegions.map((item) => <button type="button" className={regions.includes(item) ? "active" : ""} key={item} onClick={() => toggle(item, regions, 3, setRegions)}>{regions.includes(item) && <Check />}{item}</button>)}</div></fieldset>
      {error && <p className="field-error">{error}</p>}
      <div className="member-taste-actions"><button type="button" className="btn btn-ghost btn-small" disabled={saving} onClick={cancel}><X />취소</button><button type="button" className="btn btn-primary btn-small" disabled={saving} onClick={() => void save()}>{saving ? "저장 중..." : "저장"}</button></div>
    </div>}
  </section>;
}
