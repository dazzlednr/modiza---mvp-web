"use client";
/* eslint-disable react-hooks/refs, react-hooks/purity -- one-time confirmed draft hydration and stable live draft snapshot require browser-only state. */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Lightbulb, MapPin, Sparkles, Users, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { RegionFields } from "@/components/common/RegionFields";
import { CustomTagInput } from "@/components/common/CustomTagInput";
import { SpaceDetailContent } from "@/components/space/SpaceDetailContent";
import { communityCategories, communityFacilities, communityMoods, formatRegion, PRIMARY_REGION } from "@/constants/taxonomy";
import type { Community, CommunityFormValues, CommunityHostProfile } from "@/types/community";
import type { CommunitySpaceRecommendation } from "@/lib/space/communityRecommendation";
import { useStepFormScroll } from "@/hooks/useStepFormScroll";

export type SpaceOption = { id: string; slug?: string; name: string; mainRegion: string; detailedRegion?: string | null; customRegion?: string | null; address: string; maxCapacity: number; thumbnailUrl?: string | null };
type Step = 1 | 2 | 3 | 4 | 5;
const steps = ["기본 정보", "활동 정보", "일정 및 위치", "장소 추천", "최종 확인"];

const blank: CommunityFormValues = {
  name: "", category: "취미", customCategory: "", shortDescription: "", description: "",
  mainRegion: PRIMARY_REGION, detailedRegion: "", customRegion: "", nextMeetingAt: "", meetingEndAt: "",
  capacity: 10, participationFee: 0, participationType: "offline", recruitmentStatus: "recruiting",
  recruitmentStartAt: "", recruitmentEndAt: "", targetAudience: "", rules: "", preparationItems: "",
  activityDescription: "", moodTags: [], requiredFacilities: [], indoorOutdoor: "indoor",
  foodDrinkNeeded: false, expectedDurationHours: 2, budgetMin: 0, budgetMax: 0, travelRange: "선택 지역 중심",
  applicationQuestions: [], tags: [], linkedSpaceId: null,
  meetingFrequencyType: "one_time", meetingFrequencyLabel: "", recommendedFor: [], participationNotices: [], durationMinutes: 120,
};
const localDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T").slice(0, 16) : "";
const fromCommunity = (community: Community): CommunityFormValues => ({ ...blank, ...community, customCategory: community.customCategory ?? "", customRegion: community.customRegion ?? "", nextMeetingAt: localDateTime(community.nextMeetingAt), meetingEndAt: localDateTime(community.meetingEndAt), recruitmentStartAt: localDateTime(community.recruitmentStartAt), recruitmentEndAt: localDateTime(community.recruitmentEndAt) });

function FieldTip({ children }: { children: React.ReactNode }) {
  return <details className="field-tip"><summary><Lightbulb size={15} />작성 팁</summary><p>{children}</p></details>;
}

export function CommunityForm({ spaces, community, suggested, assisted = false }: { spaces: SpaceOption[]; community?: Community; suggested?: Partial<CommunityFormValues>; assisted?: boolean }) {
  const router = useRouter();
  const draftKey = community ? `modiza:community-draft:${community.id}` : suggested?.linkedSpaceId ? `modiza:community-draft:new:${suggested.linkedSpaceId}` : "modiza:community-draft:new";
  const initial = useRef<CommunityFormValues>(community ? fromCommunity(community) : { ...blank, ...suggested }).current;
  const [values, setValues] = useState(initial);
  const valuesRef = useRef(initial);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [recommendations, setRecommendations] = useState<CommunitySpaceRecommendation[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState("");
  const [detailSpace, setDetailSpace] = useState<CommunitySpaceRecommendation | null>(null);
  const [hostProfile, setHostProfile] = useState<CommunityHostProfile | null>(null);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const { errorRef, scrollToError, stepStartRef } = useStepFormScroll(step);
  valuesRef.current = values;

  useEffect(() => {
    fetch("/api/community-host-profile").then(response=>response.ok?response.json():null).then(setHostProfile).catch(()=>null);
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (!saved || community) return;
      const restored = { ...initial, ...JSON.parse(saved) } as CommunityFormValues;
      if (window.confirm("이전에 작성하던 커뮤니티 내용을 복구할까요?")) {
        setValues(restored);
        valuesRef.current = restored;
        setNotice("작성 중이던 내용을 복구했어요.");
      }
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

  function update<K extends keyof CommunityFormValues>(key: K, value: CommunityFormValues[K]) { setValues((current) => ({ ...current, [key]: value })); setFinalConfirmed(false); setError(""); setNotice(""); }
  function toggle(key: "moodTags" | "requiredFacilities", value: string) { update(key, values[key].includes(value) ? values[key].filter((item) => item !== value) : [...values[key], value]); }
  const customMoodTags = values.moodTags.filter((item) => !communityMoods.includes(item as (typeof communityMoods)[number]));
  const customFacilityTags = values.requiredFacilities.filter((item) => !communityFacilities.includes(item as (typeof communityFacilities)[number]));
  const setCustomTags = (key: "moodTags" | "requiredFacilities", presets: readonly string[], custom: string[]) => update(key, [...values[key].filter((item) => presets.includes(item)), ...custom]);
  const selected = spaces.find((space) => space.id === values.linkedSpaceId);
  const basicComplete = Boolean(values.name.trim().length >= 2 && values.shortDescription.trim().length >= 5 && values.description.trim().length >= 10 && (values.targetAudience?.trim().length ?? 0) >= 2 && values.capacity > 0);
  const activityComplete = Boolean(values.activityDescription.trim().length >= 5 && values.expectedDurationHours >= .5);
  const scheduleComplete = Boolean(values.nextMeetingAt && values.detailedRegion && (values.detailedRegion !== "기타" || values.customRegion?.trim()) && (values.budgetMax <= 0 || values.budgetMax >= values.budgetMin));
  const progressItems = steps.map((label, index) => ({
    label,
    done: [basicComplete, activityComplete, scheduleComplete, step >= 5, step === 5 && finalConfirmed][index],
  }));
  const completedCount = progressItems.filter((item) => item.done).length;
  const progress = Math.round((completedCount / progressItems.length) * 100);

  function validate(target: Step) {
    if (target >= 1 && values.name.trim().length < 2) return "커뮤니티명은 2자 이상 입력해 주세요.";
    if (target >= 1 && values.shortDescription.trim().length < 5) return "한 줄 소개는 5자 이상 입력해 주세요.";
    if (target >= 1 && values.description.trim().length < 10) return "커뮤니티 소개는 10자 이상 입력해 주세요.";
    if (target >= 1 && (values.targetAudience?.trim().length ?? 0) < 2) return "참여 대상은 2자 이상 입력해 주세요.";
    if (target >= 1 && values.capacity < 1) return "최대 인원은 1명 이상 입력해 주세요.";
    if (target >= 2 && values.activityDescription.trim().length < 5) return "진행할 활동은 5자 이상 입력해 주세요.";
    if (target >= 2 && values.expectedDurationHours < .5) return "예상 활동 시간을 확인해 주세요.";
    if (target >= 3 && !values.nextMeetingAt) return "모임 시작 일시를 선택해 주세요.";
    if (target >= 3 && new Date(`${values.nextMeetingAt}:00+09:00`).getTime() < Date.now() + 60 * 60 * 1000) return "모임 시작은 현재부터 1시간보다 뒤로 설정해 주세요.";
    if (target >= 3 && !values.detailedRegion) return "세부 지역을 선택해 주세요.";
    if (target >= 3 && values.detailedRegion === "기타" && !values.customRegion?.trim()) return "기타 지역명을 입력해 주세요.";
    if (target >= 3 && values.budgetMax > 0 && values.budgetMax < values.budgetMin) return "최대 예산은 최소 예산보다 커야 해요.";
    if (target >= 5 && !finalConfirmed) return "최종 내용을 확인한 뒤 확인 항목에 체크해 주세요.";
    if (selected && values.capacity > selected.maxCapacity) return `선택한 공간은 최대 ${selected.maxCapacity}명까지 이용할 수 있어요.`;
    return "";
  }

  async function loadRecommendations(nextValues = valuesRef.current) {
    setRecommendLoading(true); setRecommendError("");
    try {
      const meetingStart = nextValues.nextMeetingAt;
      const meetingEnd = nextValues.meetingEndAt || (meetingStart
        ? new Date(new Date(`${meetingStart}:00+09:00`).getTime() + nextValues.expectedDurationHours * 60 * 60 * 1000).toISOString()
        : undefined);
      const response = await fetch("/api/community-space-recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: nextValues.category, activityDescription: nextValues.activityDescription, moods: nextValues.moodTags, capacity: nextValues.capacity, facilities: nextValues.requiredFacilities, foodDrinkNeeded: nextValues.foodDrinkNeeded, detailedRegion: nextValues.detailedRegion, customRegion: nextValues.customRegion || undefined, budgetMax: nextValues.budgetMax, expectedDurationHours: nextValues.expectedDurationHours, meetingStartAt: meetingStart, meetingEndAt: meetingEnd, meetingFrequencyType: nextValues.meetingFrequencyType }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setRecommendations(result.results ?? []);
    } catch (caught) { setRecommendations([]); setRecommendError(caught instanceof Error ? caught.message : "공간 추천을 불러오지 못했어요."); }
    finally { setRecommendLoading(false); }
  }

  async function next() {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      scrollToError();
      return;
    }
    if (step === 3) { goToStep(4); await loadRecommendations(); return; }
    if (step < 5) goToStep((step + 1) as Step);
  }

  function goToStep(nextStep: Step) {
    setStep(nextStep);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(5);
    if (problem) {
      setError(problem);
      scrollToError();
      return;
    }
    setSaving(true); setError("");
    try {
      const meeting = new Date(`${values.nextMeetingAt}:00+09:00`);
      const candidateSpace = recommendations.find((space) => space.id === values.linkedSpaceId)
        ?? spaces.find((space) => space.id === values.linkedSpaceId);
      const normalized: CommunityFormValues = { ...values, linkedSpaceId: community ? values.linkedSpaceId : null, mainRegion: PRIMARY_REGION, customCategory: "", customRegion: values.detailedRegion === "기타" ? values.customRegion : "", recruitmentStatus: "recruiting", recruitmentStartAt: new Date().toISOString(), recruitmentEndAt: new Date(meeting.getTime() - 60 * 60 * 1000).toISOString(), meetingEndAt: values.meetingEndAt || new Date(meeting.getTime() + values.expectedDurationHours * 60 * 60 * 1000).toISOString(), applicationQuestions: values.applicationQuestions.map((item) => item.trim()).filter(Boolean), recommendedFor: values.recommendedFor.map(item=>item.trim()).filter(Boolean), participationNotices: values.participationNotices.map(item=>item.trim()).filter(Boolean), durationMinutes: Math.round(values.expectedDurationHours*60) };
      const form = new FormData(); form.set("values", JSON.stringify(normalized)); form.set("status", "published"); if (!community && candidateSpace) form.set("requestedSpaceId", candidateSpace.id); if (file) form.set("thumbnail", file); activityFiles.forEach(image=>form.append("activityImages",image));
      const response = await fetch(community ? `/api/communities/${community.id}` : "/api/communities", { method: community ? "PUT" : "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "커뮤니티를 저장하지 못했어요.");
      sessionStorage.removeItem(draftKey);
      const nextPath = result.spaceRequestCreated ? "/dashboard/communities/space-requests" : "/dashboard/communities";
      const setupPath = `/communities/${encodeURIComponent(result.id)}/open-chat/setup?next=${encodeURIComponent(nextPath)}`;
      router.push(community ? "/dashboard/communities" : setupPath);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "커뮤니티를 저장하지 못했어요."); }
    finally { setSaving(false); }
  }

  return <form className="form community-wizard" onSubmit={submit} noValidate>
    {!assisted && <aside className="registration-guide"><Lightbulb /><div><strong>모디자가 알려드려요.</strong><p>구체적으로 작성할수록 참여자가 모임을 이해하기 쉬워집니다. 등록 후에도 언제든 수정할 수 있으며, 운영 연락처는 별도 항목을 이용해 주세요.</p></div></aside>}
    <section ref={stepStartRef} className="panel registration-progress" aria-label="커뮤니티 등록 진행률">
      <div className="section-heading"><div><p className="eyebrow">Registration progress</p><h2>커뮤니티 등록</h2></div><strong>{progress}%</strong></div>
      <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
      <div className="registration-progress-items">{progressItems.map((item, index) => <span className={`${item.done ? "done" : ""} ${step === index + 1 ? "active" : ""}`.trim()} key={item.label}>{item.done ? <Check size={15} /> : "○"}{item.label}</span>)}</div>
      {progress >= 60 && progress < 100 && <p className="almost-done"><Sparkles size={17} /><span><strong>거의 다 작성했어요!</strong> 남은 단계에서 장소 추천과 최종 내용을 확인해 주세요.</span></p>}
      {progress === 100 && <p className="almost-done"><Sparkles size={17} /><span><strong>등록 준비가 완료됐어요!</strong> 마지막 단계에서 내용을 한 번 더 확인해 주세요.</span></p>}
    </section>
    <ol className="wizard-steps">{progressItems.map((item, index) => <li key={item.label} className={step === index + 1 ? "active" : item.done ? "done" : ""}><span>{item.done && step !== index + 1 ? <Check size={15} /> : index + 1}</span><b>{item.label}</b></li>)}</ol>
    <p className="muted wizard-draft-status">작성 내용은 1초 후 이 브라우저 탭에 자동 임시 저장됩니다.</p>

    {step === 1 && <section className="panel wizard-panel"><p className="eyebrow">Step 1</p><h2>기본 정보</h2><div className="grid form-grid"><label>커뮤니티명<input className="field" required minLength={2} value={values.name} maxLength={80} placeholder="예: 퇴근 후 독서모임" onChange={(event) => update("name", event.target.value)} /><span className="field-help">2자 이상 입력해 주세요.</span><FieldTip>활동과 분위기를 함께 담으면 모임의 특징을 쉽게 전달할 수 있어요.</FieldTip></label><label>카테고리<select className="field" value={values.category} onChange={(event) => update("category", event.target.value as CommunityFormValues["category"])}>{communityCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>참여 대상<input className="field" required minLength={2} value={values.targetAudience ?? ""} placeholder="예: 대구에 거주하는 20~30대" onChange={(event) => update("targetAudience", event.target.value)} /><span className="field-help">2자 이상 입력해 주세요.</span></label><label>최대 인원<input className="field" type="number" min={1} value={values.capacity || ""} onChange={(event) => update("capacity", Number(event.target.value))} /></label></div><label>한 줄 소개<input className="field" required minLength={5} maxLength={160} value={values.shortDescription} placeholder="예: 책을 매개로 사람들과 편하게 이야기하는 독서모임입니다." onChange={(event) => update("shortDescription", event.target.value)} /><span className="field-help">5자 이상 입력해 주세요.</span><FieldTip>한 문장만으로 어떤 모임인지 쉽게 이해할 수 있도록 작성해보세요.</FieldTip></label><label>커뮤니티 소개<textarea className="field" required minLength={10} rows={6} value={values.description} placeholder="어떤 모임인지, 어떻게 진행되는지, 어떤 분들과 함께하고 싶은지 소개해주세요." onChange={(event) => update("description", event.target.value)} /><span className="field-help">10자 이상 입력해 주세요.</span><FieldTip>어떤 모임인지, 어떻게 진행되는지, 어떤 분들이 참여하면 좋은지 차례로 소개해보세요.</FieldTip></label></section>}

    {step === 2 && <section className="panel wizard-panel">
      <p className="eyebrow">Step 2</p><h2>활동 정보</h2>
      <label>어떤 활동을 진행하나요?<textarea className="field" required minLength={5} rows={5} value={values.activityDescription} placeholder="예: 매회 한 권을 정해 읽고, 인상 깊었던 부분과 서로의 생각을 편하게 나눕니다." onChange={(event) => update("activityDescription", event.target.value)} /><span className="field-help">5자 이상 입력해 주세요.</span><FieldTip>참여자가 실제 모임 모습을 그릴 수 있도록 진행 순서와 활동 방식을 알려주세요.</FieldTip></label>
      <fieldset><legend>원하는 모임 분위기</legend><div className="category-row">{communityMoods.map((item) => <button type="button" className={`category ${values.moodTags.includes(item) ? "active" : ""}`} key={item} onClick={() => toggle("moodTags", item)}>{item}</button>)}</div></fieldset>
      <CustomTagInput values={customMoodTags} onChange={(custom) => setCustomTags("moodTags", communityMoods, custom)} addLabel="직접 입력" placeholder="예: #퇴근후힐링" />
      <fieldset><legend>필요한 시설</legend><div className="category-row">{communityFacilities.map((item) => <button type="button" className={`category ${values.requiredFacilities.includes(item) ? "active" : ""}`} key={item} onClick={() => toggle("requiredFacilities", item)}>{item}</button>)}</div></fieldset>
      <CustomTagInput values={customFacilityTags} onChange={(custom) => setCustomTags("requiredFacilities", communityFacilities, custom)} addLabel="기타 시설 추가" placeholder="예: 조명 장비" />
      <span className="field-help">직접 입력한 시설도 장소 추천 조건에 함께 반영됩니다.</span>
      <div className="grid form-grid"><label>활동 장소<select className="field" value={values.indoorOutdoor} onChange={(event) => update("indoorOutdoor", event.target.value as CommunityFormValues["indoorOutdoor"])}><option value="indoor">실내</option><option value="outdoor">실외</option><option value="both">실내·실외 모두</option></select></label><label>예상 활동 시간<input className="field" type="number" min={.5} step={.5} value={values.expectedDurationHours || ""} onChange={(event) => update("expectedDurationHours", Number(event.target.value))} /></label></div>
      <fieldset><legend>모임 진행 중 음식 또는 음료가 필요한가요?</legend><div className="choice-row"><label className="radio-choice"><input type="radio" name="foodDrinkNeeded" checked={values.foodDrinkNeeded} onChange={() => update("foodDrinkNeeded", true)} />필요해요</label><label className="radio-choice"><input type="radio" name="foodDrinkNeeded" checked={!values.foodDrinkNeeded} onChange={() => update("foodDrinkNeeded", false)} />없어도 괜찮아요</label></div><span className="field-help">음식 반입 가능 여부, 음료 제공 또는 카페형 장소를 추천할 때 활용합니다.</span></fieldset>
      <label>준비물<textarea className="field" rows={3} value={values.preparationItems ?? ""} placeholder="예: 읽고 있는 책, 필기도구" onChange={(event) => update("preparationItems", event.target.value)} /></label>
      <label>추가 신청 질문 · 한 줄에 하나<textarea className="field" rows={4} value={values.applicationQuestions.join("\n")} placeholder={"예: 이 모임에 참여하고 싶은 이유를 알려주세요.\n모임에서 나누고 싶은 이야기가 있나요?"} onChange={(event) => update("applicationQuestions", event.target.value.split("\n"))} /><FieldTip>참여 의지를 확인할 수 있는 질문을 1~3개 정도 권장합니다. 질문 하나를 한 줄에 적어주세요.</FieldTip></label>
    </section>}

    {step === 3 && <section className="panel wizard-panel"><p className="eyebrow">Step 3</p><h2>일정 및 위치</h2><label>모임 시작 일시<input className="field" type="datetime-local" value={values.nextMeetingAt} min={localDateTime(new Date(Date.now() + 60 * 60 * 1000).toISOString())} onChange={(event) => update("nextMeetingAt", event.target.value)} /></label><RegionFields mainRegion={values.mainRegion} detailedRegion={values.detailedRegion} customRegion={values.customRegion} onChange={(region) => setValues((current) => ({ ...current, ...region }))} /><div className="grid form-grid"><label>희망 최소 예산<input className="field" type="number" inputMode="numeric" min={0} value={values.budgetMin || ""} placeholder="0" onChange={(event) => update("budgetMin", Number(event.target.value))} /></label><label>희망 최대 예산<input className="field" type="number" inputMode="numeric" min={0} value={values.budgetMax || ""} placeholder="0" onChange={(event) => update("budgetMax", Number(event.target.value))} /></label><label>이동 가능 범위<select className="field" value={values.travelRange} onChange={(event) => update("travelRange", event.target.value)}><option>선택 지역 중심</option><option>인접 구까지</option><option>대구 전역</option></select></label><label>참가비<input className="field" type="number" inputMode="numeric" min={0} value={values.participationFee || ""} placeholder="0" onChange={(event) => update("participationFee", Number(event.target.value))} /></label></div><div className="automatic-window"><strong>커뮤니티를 등록하면 바로 모집이 시작됩니다.</strong><span>참여자가 일정 직전까지 신청할 수 있도록 모임 시작 1시간 전에 자동으로 모집이 마감됩니다.</span></div></section>}

    {step === 4 && <section className="panel wizard-panel">
      <p className="eyebrow">Step 4</p><h2>장소 추천</h2>
      <p className="rule-recommendation-notice">입력한 조건과 등록 공간 정보를 규칙으로 비교한 결과이며, 별점이나 이용자 평점이 아닙니다.</p>
      <p className="muted">여러 장소의 상세 정보를 비교한 뒤 모임에 맞는 곳을 선택해보세요.</p>
      {recommendLoading ? <div className="empty">조건에 맞는 장소를 찾고 있습니다.</div> : recommendations.length
        ? <div className="recommendation-select-grid">{recommendations.map((space) => {
          const isSelected = values.linkedSpaceId === space.id;
          return <article className={`recommendation-select-card ${isSelected ? "selected" : ""}`} key={space.id}>
            {space.thumbnailUrl
              ? <div className="cover"><Image src={space.thumbnailUrl} alt={space.name} fill /></div>
              : <div className="cover recommendation-photo-empty"><ImagePlus aria-hidden="true" /><span>대표 사진 없음</span></div>}
            <div className="recommendation-card-content">
              <h3>{space.name}</h3>
              <div className="recommendation-status-row"><span className={`availability-badge ${space.availabilityStatus}`}>{space.availabilityLabel}</span><span className="fit-label">{space.fitLabel}</span></div>
              <p><MapPin size={14} /> {space.location}</p>
              <p>{space.totalPrice.toLocaleString("ko-KR")}원 예상 · 최대 {space.maxCapacity}명</p>
              <ul className="recommendation-evidence">{space.reasons.map((reason) => <li key={reason}><Check size={14} />{reason}</li>)}</ul>
              <p className="availability-summary">{space.availabilitySummary}</p>
              {isSelected && <span className="selected-space-label"><Check size={15} /> 현재 선택된 공간입니다.</span>}
              <div className="recommendation-card-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setDetailSpace(space)}>자세히 보기</button>
                <button type="button" className="btn btn-primary" disabled={isSelected} onClick={() => update("linkedSpaceId", space.id)}>{isSelected ? "선택됨" : space.details.communityUseMode === "request_consultation" ? "이용 문의하기" : "선택하기"}</button>
              </div>
            </div>
          </article>;
        })}</div>
        : <div className="empty"><h3>현재 조건에 맞는 추천 장소가 없어요.</h3><p className="muted">조건을 조정하거나 장소 없이 먼저 등록할 수 있어요.</p><div className="management-actions"><button type="button" className="btn btn-ghost" onClick={() => { const nextValues = { ...values, travelRange: "대구 전역" }; setValues(nextValues); void loadRecommendations(nextValues); }}>지역 범위 넓히기</button><button type="button" className="btn btn-ghost" onClick={() => { const nextValues = { ...values, budgetMax: Math.max(10000, values.budgetMax + 20000) }; setValues(nextValues); void loadRecommendations(nextValues); }}>예산 범위 넓히기</button><button type="button" className="btn btn-ghost" onClick={() => { const nextValues = { ...values, requiredFacilities: [] }; setValues(nextValues); void loadRecommendations(nextValues); }}>시설 조건 해제</button><button type="button" className="btn btn-primary" onClick={() => { update("linkedSpaceId", null); setStep(5); }}>장소 없이 등록하기</button></div>{recommendError && <p className="field-error">{recommendError} 규칙 기반 조건을 조정하거나 장소 없이 등록해 주세요.</p>}</div>}
    </section>}

    {step === 5 && <section className="panel wizard-panel"><p className="eyebrow">Step 5</p><h2>최종 확인 및 등록</h2><div className="review-sections"><article><button type="button" onClick={() => setStep(1)}>수정</button><span>기본 정보</span><strong>{values.name}</strong><p>{values.category} · {values.capacity}명 · {values.targetAudience}</p></article><article><button type="button" onClick={() => setStep(2)}>수정</button><span>활동 정보</span><strong>{values.activityDescription}</strong><p>{values.moodTags.join(", ") || "분위기 미지정"} · {values.expectedDurationHours}시간</p></article><article><button type="button" onClick={() => setStep(3)}>수정</button><span>일정 및 지역</span><strong>{values.nextMeetingAt ? new Date(`${values.nextMeetingAt}:00+09:00`).toLocaleString("ko-KR") : "미정"}</strong><p>{formatRegion(values.mainRegion, values.detailedRegion, values.customRegion)}</p><p>등록 즉시 모집 시작 · 모임 1시간 전 마감</p></article><article><button type="button" onClick={() => setStep(4)}>수정</button><span>선택 공간</span><strong>{selected?.name ?? "공간 연결 안 함"}</strong></article></div><label className="upload"><ImagePlus style={{ margin: "auto" }} /><b>대표 이미지 선택</b><span>JPG, PNG, WebP · 5MB 이하</span><input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && next.size <= 5_242_880) setFile(next); else setError("5MB 이하 이미지를 선택해 주세요."); }} /></label>{file && <span className="tag">선택됨: {file.name}</span>}</section>}

    {step === 2 && <section className="panel wizard-panel"><h3>참여자에게 더 알려주세요</h3><div className="grid form-grid"><label>모임 주기<select className="field" value={values.meetingFrequencyType} onChange={event=>update("meetingFrequencyType",event.target.value as CommunityFormValues["meetingFrequencyType"])}><option value="one_time">한 번 진행</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option><option value="custom">직접 입력</option></select></label><label>주기 안내<input className="field" value={values.meetingFrequencyLabel??""} onChange={event=>update("meetingFrequencyLabel",event.target.value)} placeholder="예: 매월 둘째 주 금요일" /></label></div><label>이런 분께 추천해요 · 한 줄에 하나<textarea className="field" rows={3} value={values.recommendedFor.join("\n")} onChange={event=>update("recommendedFor",event.target.value.split("\n"))} placeholder={"예: 퇴근 후 편안하게 대화하고 싶은 분\n새로운 취향 친구를 만나고 싶은 분"}/></label><label>참여 전 확인사항 · 한 줄에 하나<textarea className="field" rows={3} value={values.participationNotices.join("\n")} onChange={event=>update("participationNotices",event.target.value.split("\n"))} placeholder={"예: 시작 10분 전까지 도착해 주세요.\n일정 변경 시 미리 알려주세요."}/></label></section>}
    {step === 5 && <section className="panel wizard-panel"><h3>활동 사진 <span className="muted">(선택)</span></h3><p className="muted">대표 이미지와 별도로 실제 활동 분위기를 보여줄 사진을 최대 8장 등록할 수 있어요.</p><label className="upload"><ImagePlus style={{margin:"auto"}}/><b>활동 사진 선택</b><span>JPG, PNG, WebP · 장당 5MB 이하</span><input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const next=Array.from(event.target.files??[]);if(next.length>8||next.some(image=>image.size>5_242_880))setError("활동 사진은 최대 8장, 장당 5MB 이하로 선택해 주세요.");else setActivityFiles(next);}}/></label>{activityFiles.length>0&&<p className="tag">{activityFiles.length}장 선택됨</p>}</section>}
    {step === 5 && <section className="panel final-confirmation"><label className="checkbox-label"><input type="checkbox" checked={finalConfirmed} onChange={(event) => { setFinalConfirmed(event.target.checked); setError(""); }} /><span><strong>위 내용을 모두 확인했습니다.</strong><small>등록 후에도 운영 대시보드에서 내용을 수정할 수 있어요.</small></span></label></section>}
    {step === 1 && hostProfile && <section className="panel community-host-card"><div className="community-host-avatar">{hostProfile.profileImage?<Image src={hostProfile.profileImage} alt={hostProfile.nickname} fill/>:<Users/>}</div><div><p className="eyebrow">Community host</p><h3>{hostProfile.nickname}</h3><strong>{hostProfile.headline}</strong><p className="muted">{[hostProfile.activityRegion,...hostProfile.operatingStyles].filter(Boolean).join(" · ")}</p><Link href="/mypage/community-host-profile">운영자 정보 수정</Link></div></section>}
    {error && <p ref={errorRef} className="error-summary" role="alert">{error}</p>}{notice && <p className="success-summary">{notice}</p>}
    <div className="wizard-actions">{step > 1 && <button type="button" className="btn btn-ghost" onClick={() => setStep((step - 1) as Step)}><ArrowLeft /> 이전</button>}<span />{step < 5 ? <button type="button" className="btn btn-primary" onClick={() => void next()}>다음 <ArrowRight /></button> : <button className="btn btn-primary" disabled={saving || !finalConfirmed}>{saving ? "등록하고 있어요." : "최종 등록"}</button>}</div>
    {detailSpace && <div className="dialog-backdrop space-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${detailSpace.name} 상세 정보`}>
      <div className="space-detail-dialog">
        <button type="button" className="dialog-close space-detail-close" aria-label="공간 상세 닫기" onClick={() => setDetailSpace(null)}><X /></button>
        <SpaceDetailContent space={detailSpace.details} actions={values.linkedSpaceId === detailSpace.id
          ? <><span className="selected-space-label"><Check size={16} /> 현재 선택된 공간입니다.</span><button type="button" className="btn btn-ghost" onClick={() => setDetailSpace(null)}>등록 화면으로 돌아가기</button></>
          : <button type="button" className="btn btn-primary" onClick={() => { update("linkedSpaceId", detailSpace.id); setDetailSpace(null); }}>{detailSpace.details.communityUseMode === "request_consultation" ? "이용 문의하기" : "이 공간 선택하기"}</button>} />
      </div>
    </div>}
  </form>;
}
