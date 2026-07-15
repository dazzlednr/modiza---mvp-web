"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, react-hooks/purity -- one-time confirmed draft hydration and stable live draft snapshot require browser-only state. */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, MapPin, Users } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RegionFields } from "@/components/common/RegionFields";
import { communityCategories, communityFacilities, communityMoods, formatRegion, PRIMARY_REGION } from "@/constants/taxonomy";
import type { Community, CommunityFormValues } from "@/types/community";
import type { CommunitySpaceRecommendation } from "@/lib/space/communityRecommendation";

type SpaceOption = { id: string; name: string; mainRegion: string; detailedRegion?: string | null; customRegion?: string | null; address: string; maxCapacity: number; thumbnailUrl?: string | null };
type Step = 1 | 2 | 3 | 4 | 5;
const steps = ["기본 정보", "활동 정보", "일정 및 위치", "공간 추천", "최종 확인"];

const blank: CommunityFormValues = {
  name: "", category: "취미", customCategory: "", shortDescription: "", description: "",
  mainRegion: PRIMARY_REGION, detailedRegion: "", customRegion: "", nextMeetingAt: "", meetingEndAt: "",
  capacity: 10, participationFee: 0, participationType: "offline", recruitmentStatus: "recruiting",
  recruitmentStartAt: "", recruitmentEndAt: "", targetAudience: "", rules: "", preparationItems: "",
  activityDescription: "", moodTags: [], requiredFacilities: [], indoorOutdoor: "indoor",
  foodDrinkNeeded: false, expectedDurationHours: 2, budgetMin: 0, budgetMax: 0, travelRange: "선택 지역 중심",
  applicationQuestions: [], tags: [], linkedSpaceId: null,
};
const localDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T").slice(0, 16) : "";
const fromCommunity = (community: Community): CommunityFormValues => ({ ...blank, ...community, customCategory: community.customCategory ?? "", customRegion: community.customRegion ?? "", nextMeetingAt: localDateTime(community.nextMeetingAt), meetingEndAt: localDateTime(community.meetingEndAt), recruitmentStartAt: localDateTime(community.recruitmentStartAt), recruitmentEndAt: localDateTime(community.recruitmentEndAt) });

export function CommunityForm({ spaces, community, suggested }: { spaces: SpaceOption[]; community?: Community; suggested?: Partial<CommunityFormValues> }) {
  const router = useRouter();
  const draftKey = community ? `modiza:community-draft:${community.id}` : suggested?.linkedSpaceId ? `modiza:community-draft:new:${suggested.linkedSpaceId}` : "modiza:community-draft:new";
  const initial = useMemo(() => community ? fromCommunity(community) : { ...blank, ...suggested }, [community, suggested]);
  const [values, setValues] = useState(initial);
  const valuesRef = useRef(initial);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [recommendations, setRecommendations] = useState<CommunitySpaceRecommendation[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState("");
  valuesRef.current = values;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (!saved || community) return;
      const restored = { ...initial, ...JSON.parse(saved) } as CommunityFormValues;
      if (window.confirm("이전에 작성하던 커뮤니티 내용을 복구할까요?")) { setValues(restored); valuesRef.current = restored; setNotice("작성 중이던 내용을 복구했어요."); }
      else sessionStorage.removeItem(draftKey);
    } catch { sessionStorage.removeItem(draftKey); }
  }, [community, draftKey, initial]);

  useEffect(() => {
    const timer = window.setTimeout(() => { try { sessionStorage.setItem(draftKey, JSON.stringify(values)); } catch { /* browser storage unavailable */ } }, 1000);
    return () => window.clearTimeout(timer);
  }, [draftKey, values]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function update<K extends keyof CommunityFormValues>(key: K, value: CommunityFormValues[K]) { setValues((current) => ({ ...current, [key]: value })); setError(""); setNotice(""); }
  function toggle(key: "moodTags" | "requiredFacilities", value: string) { update(key, values[key].includes(value) ? values[key].filter((item) => item !== value) : [...values[key], value]); }
  const selected = spaces.find((space) => space.id === values.linkedSpaceId);

  function validate(target: Step) {
    if (target >= 1 && (!values.name.trim() || !values.shortDescription.trim() || !values.description.trim() || !values.targetAudience?.trim() || values.capacity < 1)) return "1단계 기본 정보를 모두 입력해 주세요.";
    if (target >= 1 && values.category === "기타" && !values.customCategory?.trim()) return "기타 카테고리명을 입력해 주세요.";
    if (target >= 2 && !values.activityDescription.trim()) return "진행할 활동을 입력해 주세요.";
    if (target >= 2 && values.expectedDurationHours < .5) return "예상 활동 시간을 확인해 주세요.";
    if (target >= 3 && !values.nextMeetingAt) return "모임 시작 일시를 선택해 주세요.";
    if (target >= 3 && new Date(`${values.nextMeetingAt}:00+09:00`).getTime() < Date.now() + 60 * 60 * 1000) return "모임 시작은 현재부터 1시간보다 뒤로 설정해 주세요.";
    if (target >= 3 && !values.detailedRegion) return "세부 지역을 선택해 주세요.";
    if (target >= 3 && values.detailedRegion === "기타" && !values.customRegion?.trim()) return "기타 지역명을 입력해 주세요.";
    if (target >= 3 && values.budgetMax > 0 && values.budgetMax < values.budgetMin) return "최대 예산은 최소 예산보다 커야 해요.";
    if (target >= 5 && !community?.thumbnailStoragePath && !file) return "대표 이미지를 선택해 주세요.";
    if (selected && values.capacity > selected.maxCapacity) return `선택한 공간은 최대 ${selected.maxCapacity}명까지 이용할 수 있어요.`;
    return "";
  }

  async function loadRecommendations(nextValues = valuesRef.current) {
    setRecommendLoading(true); setRecommendError("");
    try {
      const response = await fetch("/api/community-space-recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: nextValues.category, activityDescription: nextValues.activityDescription, moods: nextValues.moodTags, capacity: nextValues.capacity, facilities: nextValues.requiredFacilities, detailedRegion: nextValues.detailedRegion, customRegion: nextValues.customRegion || undefined, budgetMax: nextValues.budgetMax, expectedDurationHours: nextValues.expectedDurationHours }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setRecommendations(result.results ?? []);
    } catch (caught) { setRecommendations([]); setRecommendError(caught instanceof Error ? caught.message : "공간 추천을 불러오지 못했어요."); }
    finally { setRecommendLoading(false); }
  }

  async function next() {
    const problem = validate(step);
    if (problem) return setError(problem);
    if (step === 3) { setStep(4); await loadRecommendations(); return; }
    if (step < 5) setStep((step + 1) as Step);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(5); if (problem) return setError(problem);
    setSaving(true); setError("");
    try {
      const meeting = new Date(`${values.nextMeetingAt}:00+09:00`);
      const normalized: CommunityFormValues = { ...values, mainRegion: PRIMARY_REGION, customCategory: values.category === "기타" ? values.customCategory : "", customRegion: values.detailedRegion === "기타" ? values.customRegion : "", recruitmentStatus: "recruiting", recruitmentStartAt: new Date().toISOString(), recruitmentEndAt: new Date(meeting.getTime() - 60 * 60 * 1000).toISOString(), meetingEndAt: values.meetingEndAt || new Date(meeting.getTime() + values.expectedDurationHours * 60 * 60 * 1000).toISOString(), applicationQuestions: values.applicationQuestions.map((item) => item.trim()).filter(Boolean) };
      const form = new FormData(); form.set("values", JSON.stringify(normalized)); form.set("status", "published"); if (file) form.set("thumbnail", file);
      const response = await fetch(community ? `/api/communities/${community.id}` : "/api/communities", { method: community ? "PUT" : "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "커뮤니티를 저장하지 못했어요.");
      sessionStorage.removeItem(draftKey);
      router.push(community ? "/dashboard/communities" : `/communities/${encodeURIComponent(result.slug)}`);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "커뮤니티를 저장하지 못했어요."); }
    finally { setSaving(false); }
  }

  return <form className="form community-wizard" onSubmit={submit} noValidate>
    <ol className="wizard-steps">{steps.map((label, index) => <li key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span><b>{label}</b></li>)}</ol>
    <p className="muted wizard-draft-status">작성 내용은 1초 후 이 브라우저 탭에 자동 임시 저장됩니다.</p>

    {step === 1 && <section className="panel wizard-panel"><p className="eyebrow">Step 1</p><h2>기본 정보</h2><div className="grid form-grid"><label>커뮤니티명<input className="field" value={values.name} maxLength={80} onChange={(event) => update("name", event.target.value)} /></label><label>카테고리<select className="field" value={values.category} onChange={(event) => update("category", event.target.value as CommunityFormValues["category"])}>{communityCategories.map((category) => <option key={category}>{category}</option>)}</select></label>{values.category === "기타" && <label>기타 카테고리명<input className="field" value={values.customCategory ?? ""} onChange={(event) => update("customCategory", event.target.value)} /></label>}<label>참여 대상<input className="field" value={values.targetAudience ?? ""} placeholder="예: 대구에 거주하는 20~30대" onChange={(event) => update("targetAudience", event.target.value)} /></label><label>최대 인원<input className="field" type="number" min={1} value={values.capacity} onChange={(event) => update("capacity", Number(event.target.value))} /></label></div><label>한 줄 소개<input className="field" maxLength={160} value={values.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} /></label><label>커뮤니티 소개<textarea className="field" rows={6} value={values.description} onChange={(event) => update("description", event.target.value)} /></label></section>}

    {step === 2 && <section className="panel wizard-panel"><p className="eyebrow">Step 2</p><h2>활동 정보</h2><label>어떤 활동을 진행하나요?<textarea className="field" rows={5} value={values.activityDescription} onChange={(event) => update("activityDescription", event.target.value)} /></label><fieldset><legend>원하는 모임 분위기</legend><div className="category-row">{communityMoods.map((item) => <button type="button" className={`category ${values.moodTags.includes(item) ? "active" : ""}`} key={item} onClick={() => toggle("moodTags", item)}>{item}</button>)}</div></fieldset><label>직접 입력 분위기<input className="field" placeholder="쉼표로 구분" value={values.tags.join(", ")} onChange={(event) => update("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><fieldset><legend>필요한 시설</legend><div className="category-row">{communityFacilities.map((item) => <button type="button" className={`category ${values.requiredFacilities.includes(item) ? "active" : ""}`} key={item} onClick={() => toggle("requiredFacilities", item)}>{item}</button>)}</div></fieldset><div className="grid form-grid"><label>활동 장소<select className="field" value={values.indoorOutdoor} onChange={(event) => update("indoorOutdoor", event.target.value as CommunityFormValues["indoorOutdoor"])}><option value="indoor">실내</option><option value="outdoor">실외</option><option value="both">실내·실외 모두</option></select></label><label>예상 활동 시간<input className="field" type="number" min={.5} step={.5} value={values.expectedDurationHours} onChange={(event) => update("expectedDurationHours", Number(event.target.value))} /></label></div><label className="checkbox-label"><input type="checkbox" checked={values.foodDrinkNeeded} onChange={(event) => update("foodDrinkNeeded", event.target.checked)} />음식 및 음료가 필요해요.</label><label>준비물<textarea className="field" rows={3} value={values.preparationItems ?? ""} onChange={(event) => update("preparationItems", event.target.value)} /></label><label>추가 신청 질문 · 한 줄에 하나<textarea className="field" rows={4} value={values.applicationQuestions.join("\n")} onChange={(event) => update("applicationQuestions", event.target.value.split("\n"))} /></label></section>}

    {step === 3 && <section className="panel wizard-panel"><p className="eyebrow">Step 3</p><h2>일정 및 위치</h2><label>모임 시작 일시<input className="field" type="datetime-local" value={values.nextMeetingAt} min={localDateTime(new Date(Date.now() + 60 * 60 * 1000).toISOString())} onChange={(event) => update("nextMeetingAt", event.target.value)} /></label><RegionFields mainRegion={values.mainRegion} detailedRegion={values.detailedRegion} customRegion={values.customRegion} onChange={(region) => setValues((current) => ({ ...current, ...region }))} /><div className="grid form-grid"><label>희망 최소 예산<input className="field" type="number" min={0} value={values.budgetMin} onChange={(event) => update("budgetMin", Number(event.target.value))} /></label><label>희망 최대 예산<input className="field" type="number" min={0} value={values.budgetMax} onChange={(event) => update("budgetMax", Number(event.target.value))} /></label><label>이동 가능 범위<select className="field" value={values.travelRange} onChange={(event) => update("travelRange", event.target.value)}><option>선택 지역 중심</option><option>인접 구까지</option><option>대구 전역</option></select></label><label>참가비<input className="field" type="number" min={0} value={values.participationFee} onChange={(event) => update("participationFee", Number(event.target.value))} /></label></div><div className="automatic-window"><strong>모집 기간은 자동으로 설정됩니다.</strong><span>등록 완료 즉시 모집 시작 · 모임 시작 1시간 전 모집 마감</span></div></section>}

    {step === 4 && <section className="panel wizard-panel"><p className="eyebrow">Step 4</p><h2>공간 추천</h2><p className="muted">지역 30 · 인원 20 · 시설 20 · 예산 15 · 분위기 10 · 활동 5점 기준입니다.</p>{recommendLoading ? <div className="empty">조건에 맞는 공간을 찾고 있습니다.</div> : recommendations.length ? <div className="recommendation-select-grid">{recommendations.map((space) => <button type="button" className={`recommendation-select-card ${values.linkedSpaceId === space.id ? "selected" : ""}`} key={space.id} onClick={() => update("linkedSpaceId", values.linkedSpaceId === space.id ? null : space.id)}>{space.thumbnailUrl && <div className="cover"><Image src={space.thumbnailUrl} alt={space.name} fill /></div>}<div><span className="recommend-score">{space.score}점</span><h3>{space.name}</h3><p><MapPin size={14} /> {space.location}</p><p>{space.totalPrice.toLocaleString("ko-KR")}원 예상 · 최대 {space.maxCapacity}명</p><div className="meta">{space.reasons.map((reason) => <span className="tag" key={reason}>✓ {reason}</span>)}</div></div></button>)}</div> : <div className="empty"><h3>현재 조건에 맞는 추천 공간이 없어요.</h3><p className="muted">조건을 조정하거나 공간 없이 먼저 등록할 수 있어요.</p><div className="management-actions"><button type="button" className="btn btn-ghost" onClick={() => { const nextValues = { ...values, travelRange: "대구 전역" }; setValues(nextValues); void loadRecommendations(nextValues); }}>지역 범위 넓히기</button><button type="button" className="btn btn-ghost" onClick={() => { const nextValues = { ...values, budgetMax: Math.max(10000, values.budgetMax + 20000) }; setValues(nextValues); void loadRecommendations(nextValues); }}>예산 범위 넓히기</button><button type="button" className="btn btn-ghost" onClick={() => { const nextValues = { ...values, requiredFacilities: [] }; setValues(nextValues); void loadRecommendations(nextValues); }}>시설 조건 해제</button><button type="button" className="btn btn-primary" onClick={() => { update("linkedSpaceId", null); setStep(5); }}>공간 없이 등록하기</button></div>{recommendError && <p className="field-error">{recommendError} 규칙 기반 조건을 조정하거나 공간 없이 등록해 주세요.</p>}</div>}</section>}

    {step === 5 && <section className="panel wizard-panel"><p className="eyebrow">Step 5</p><h2>최종 확인 및 등록</h2><div className="review-sections"><article><button type="button" onClick={() => setStep(1)}>수정</button><span>기본 정보</span><strong>{values.name}</strong><p>{values.category === "기타" ? values.customCategory : values.category} · {values.capacity}명 · {values.targetAudience}</p></article><article><button type="button" onClick={() => setStep(2)}>수정</button><span>활동 정보</span><strong>{values.activityDescription}</strong><p>{values.moodTags.join(", ") || "분위기 미지정"} · {values.expectedDurationHours}시간</p></article><article><button type="button" onClick={() => setStep(3)}>수정</button><span>일정 및 지역</span><strong>{values.nextMeetingAt ? new Date(`${values.nextMeetingAt}:00+09:00`).toLocaleString("ko-KR") : "미정"}</strong><p>{formatRegion(values.mainRegion, values.detailedRegion, values.customRegion)}</p><p>등록 즉시 모집 시작 · 모임 1시간 전 마감</p></article><article><button type="button" onClick={() => setStep(4)}>수정</button><span>선택 공간</span><strong>{selected?.name ?? "공간 연결 안 함"}</strong></article></div><label className="upload"><ImagePlus style={{ margin: "auto" }} /><b>대표 이미지 선택</b><span>JPG, PNG, WebP · 5MB 이하</span><input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && next.size <= 5_242_880) setFile(next); else setError("5MB 이하 이미지를 선택해 주세요."); }} /></label>{file && <span className="tag">선택됨: {file.name}</span>}</section>}

    {error && <p className="error-summary" role="alert">{error}</p>}{notice && <p className="success-summary">{notice}</p>}
    <div className="wizard-actions">{step > 1 && <button type="button" className="btn btn-ghost" onClick={() => setStep((step - 1) as Step)}><ArrowLeft /> 이전</button>}<span />{step < 5 ? <button type="button" className="btn btn-primary" onClick={() => void next()}>다음 <ArrowRight /></button> : <button className="btn btn-primary" disabled={saving}>{saving ? "등록하고 있어요." : "최종 등록"}</button>}</div>
  </form>;
}
