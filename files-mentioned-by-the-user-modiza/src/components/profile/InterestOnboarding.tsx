"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { personalizationCategories, personalizationRegions } from "@/constants/personalization";

export function InterestOnboarding({ initialCategories, initialRegions }: { initialCategories: string[]; initialRegions: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [categories, setCategories] = useState(initialCategories.slice(0, 5));
  const [regions, setRegions] = useState(initialRegions.slice(0, 3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (value: string, current: string[], limit: number, set: (values: string[]) => void) => {
    if (current.includes(value)) set(current.filter((item) => item !== value));
    else if (current.length < limit) set([...current, value]);
    else setError(`\uCD5C\uB300 ${limit}\uAC1C\uAE4C\uC9C0 \uC120\uD0DD\uD560 \uC218 \uC788\uC5B4\uC694.`);
  };

  async function finish(nextRegions = regions) {
    setSaving(true); setError("");
    const response = await fetch("/api/profile/interests", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories, regions: nextRegions }) });
    if (!response.ok) { setError((await response.json()).message); setSaving(false); return; }
    router.replace("/"); router.refresh();
  }

  return <div className="panel onboarding-card">
    <p className="eyebrow">Personalize MODIZA · {step}/2</p>
    {step === 1 ? <>
      <h1>{"\uAD00\uC2EC \uC788\uB294 \uD65C\uB3D9\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."}</h1>
      <p className="muted">{"\uAD00\uC2EC\uC0AC\uC5D0 \uB9DE\uB294 \uCEE4\uBBA4\uB2C8\uD2F0\uB97C \uCD94\uCC9C\uD574\uB4DC\uB9BD\uB2C8\uB2E4. 1~5\uAC1C\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."}</p>
      <div className="interest-grid">{personalizationCategories.map((item) => <button type="button" className={`category ${categories.includes(item) ? "active" : ""}`} key={item} onClick={() => toggle(item, categories, 5, setCategories)}>{item}</button>)}</div>
      <div className="onboarding-actions"><button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>{"\uAC74\uB108\uB6F0\uAE30"}</button><button type="button" className="btn btn-primary" disabled={!categories.length} onClick={() => setStep(2)}>{"\uB2E4\uC74C"}</button></div>
    </> : <>
      <h1>{"\uAD00\uC2EC \uC9C0\uC5ED\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."}</h1>
      <p className="muted">{"\uC8FC\uB85C \uD65C\uB3D9\uD560 \uC9C0\uC5ED\uC744 1~3\uAC1C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."}</p>
      <div className="interest-grid">{personalizationRegions.map((item) => <button type="button" className={`category ${regions.includes(item) ? "active" : ""}`} key={item} onClick={() => toggle(item, regions, 3, setRegions)}>{item}</button>)}</div>
      <div className="onboarding-actions"><button type="button" className="btn btn-ghost" disabled={saving} onClick={() => void finish([])}>{"\uAC74\uB108\uB6F0\uAE30"}</button><button type="button" className="btn btn-primary" disabled={saving || !regions.length} onClick={() => void finish()}>{saving ? "\uC800\uC7A5 \uC911..." : "\uC120\uD0DD \uC644\uB8CC"}</button></div>
    </>}
    {error && <p className="field-error">{error}</p>}
  </div>;
}
