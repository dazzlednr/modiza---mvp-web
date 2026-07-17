"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Camera, CheckCircle2, ImagePlus, LoaderCircle, Sparkles, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SpaceForm } from "@/components/space/SpaceForm";
import type { SpaceFormValues } from "@/types/space";
import type { SpaceAnalysisResult } from "@/types/space-analysis";

const MIN_ANALYSIS_PHOTOS = 5;
const MAX_ANALYSIS_PHOTOS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const fixedOptions = {
  facilities: ["빔프로젝터","스크린","스피커","마이크","화이트보드","긴 테이블","개별 테이블","의자","와이파이","콘센트","주방","화장실","냉난방","주차"],
  moods: ["조용한","따뜻한","아늑한","감각적인","밝은","자연광이 좋은","전문적인","자유로운","활동적인","독특한"],
  activities: ["독서모임","영화모임","글쓰기","네트워킹","스터디","워크숍","촬영","전시","공연","원데이 클래스","보드게임","소규모 행사"],
};

function normalizeSuggestions(values: string[], fixed: string[]) {
  const unique = values.map((value) => value.trim().replace(/^#+/, "")).filter((value, index, all) => value && all.findIndex((item) => item.toLocaleLowerCase("ko-KR") === value.toLocaleLowerCase("ko-KR")) === index);
  return [...fixed.filter((item) => unique.includes(item)), ...unique.filter((item) => !fixed.includes(item)).slice(0, 3)];
}

function photoSignature(files: File[]) {
  return files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
}

async function optimizeForAnalysis(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }) : file;
  } catch {
    return file;
  }
}

function PhotoGuide() {
  return <details className="panel space-photo-guide">
    <summary><Camera />📷 어떤 사진을 올리면 좋을까요?<span>자세히 보기</span></summary>
    <div className="space-photo-guide-grid">
      <article><b>① 공간 전체 — 필수</b><p>전체 크기와 분위기가 보이도록 서로 다른 방향에서 2장 이상 찍어주세요.</p></article>
      <article><b>② 좌석과 테이블</b><p>좌석 배치, 테이블 간격과 실제 이용 가능한 범위를 보여주세요.</p></article>
      <article><b>③ 주요 시설</b><p>프로젝터, 화이트보드, 모니터, 음향기기, 콘센트, 주방과 냉난방 시설을 담아주세요.</p></article>
      <article><b>④ 공간의 분위기</b><p>조명, 인테리어, 창가, 식물, 자연광, 벽과 바닥이 잘 보이면 좋아요.</p></article>
      <article><b>⑤ 활동 가능한 영역</b><p>모임, 발표, 스터디, 촬영이나 클래스가 진행될 실제 영역을 보여주세요.</p></article>
    </div>
    <div className="space-photo-help"><p><b>좋은 사진</b> 밝고 선명하며 전체 공간과 시설이 가려지지 않은 서로 다른 각도의 사진</p><p><b>피해주세요</b> 비슷한 사진 반복, 사람이 대부분을 가린 사진, 어둡거나 흔들린 사진, 과한 필터와 무관한 홍보 이미지</p></div>
  </details>;
}

function AnalysisScope() {
  return <aside className="panel analysis-scope"><div><h2>모디자가 사진에서 이런 내용을 살펴봐요</h2><p className="analysis-scope-description">공간의 시설과 분위기, 어울리는 활동을 먼저 정리해드릴게요.<br />분석 결과는 참고용이며 실제 공간에 맞게 자유롭게 수정할 수 있어요.</p></div><div className="category-row analysis-scope-items">{["공간 유형","시설","분위기","인테리어","좌석 형태","적합한 활동","예상 이용 인원","확인이 필요한 부분"].map((item) => <span className="category" key={item}>{item}</span>)}</div><p className="muted analysis-scope-note">사진만으로 정확히 알기 어려운 내용은 참고용으로 제안해드려요. 실제 공간에 맞게 자유롭게 수정해주세요.</p></aside>;
}

export function SpaceRegistrationAssistant({ initialSuggested }: { initialSuggested?: Partial<SpaceFormValues> }) {
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<SpaceAnalysisResult | null>(null);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [analyzedSignature, setAnalyzedSignature] = useState("");
  const [photosChanged, setPhotosChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const suggested = useMemo<Partial<SpaceFormValues> | undefined>(() => analysis ? {
    ...initialSuggested,
    spaceType: ["카페","스튜디오","공방","회의실","연습실","복합문화공간","독립 공간"].includes(analysis.spaceType) ? analysis.spaceType : "기타",
    facilities: normalizeSuggestions(analysis.visibleFacilities.map((item) => item.name), fixedOptions.facilities),
    moods: normalizeSuggestions(analysis.moods, fixedOptions.moods),
    suitableActivities: normalizeSuggestions(analysis.activities, fixedOptions.activities),
  } : initialSuggested, [analysis, initialSuggested]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview)), [previews]);

  function commitFiles(next: File[]) {
    setFiles(next);
    setError("");
    if (analysis) setPhotosChanged(true);
  }

  function add(nextFiles: File[]) {
    if (!nextFiles.length) return;
    const unsupported = nextFiles.some((file) => !allowedTypes.has(file.type));
    const oversized = nextFiles.some((file) => file.size > MAX_FILE_SIZE);
    const valid = nextFiles.filter((file) => allowedTypes.has(file.type) && file.size <= MAX_FILE_SIZE);
    const combined = [...files, ...valid].filter((file, index, all) => all.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index);
    if (combined.length > MAX_ANALYSIS_PHOTOS) {
      setError("사진은 최대 10장까지 등록할 수 있어요.");
      return;
    }
    commitFiles(combined);
    if (unsupported) setError("JPG, PNG 또는 WEBP 형식의 사진을 올려주세요.");
    else if (oversized) setError("사진 한 장의 용량은 최대 10MB까지 가능합니다.");
  }

  function remove(index: number) { commitFiles(files.filter((_, itemIndex) => itemIndex !== index)); }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    commitFiles(next);
  }
  function makeThumbnail(index: number) { if (index > 0) commitFiles([files[index], ...files.filter((_, itemIndex) => itemIndex !== index)]); }

  async function analyze(reanalysis = false) {
    if (files.length < MIN_ANALYSIS_PHOTOS) return setError("분석을 위해 사진을 최소 5장 올려주세요.");
    const signature = photoSignature(files);
    if (analysis && signature === analyzedSignature) return setError("사진 구성이 같아 현재 분석 결과를 유지했어요.");
    if (reanalysis && analysis && !confirm("직접 수정한 내용이 있을 수 있어요. 새 분석 결과로 다시 채울까요?")) return;
    setLoading(true);
    setError("");
    try {
      const optimized = await Promise.all(files.map(optimizeForAnalysis));
      const form = new FormData();
      optimized.forEach((file) => form.append("images", file));
      const response = await fetch("/api/spaces/draft-analysis", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "모디자가 사진을 분석하지 못했어요. 다시 시도하거나 직접 작성해주세요.");
      setAnalysis(result.analysis as SpaceAnalysisResult);
      setAnalysisVersion((version) => version + 1);
      setAnalyzedSignature(signature);
      setPhotosChanged(false);
    } catch (caught) {
      setError(caught instanceof TypeError ? "사진 분석 중 문제가 발생했어요. 업로드한 사진과 작성 내용은 그대로 유지됩니다." : caught instanceof Error ? caught.message : "모디자가 사진을 분석하지 못했어요. 다시 시도하거나 직접 작성해주세요.");
    } finally {
      setLoading(false);
    }
  }

  const remaining = Math.max(0, MIN_ANALYSIS_PHOTOS - files.length);
  const ready = files.length >= MIN_ANALYSIS_PHOTOS;
  return <div className="form">
    <section className="panel space-assistant-upload">
      <div><p className="eyebrow">Step 1 · Photo analysis</p><h1>공간 사진을 먼저 보여주세요.</h1><p className="muted">다양한 각도의 사진을 올리면 모디자가 공간을 더 정확하게 살펴볼 수 있어요. AI 분석을 위해 최소 5장, 최대 10장까지 등록해주세요.</p></div>
      <div className={`photo-count-status ${ready ? "ready" : ""}`}><strong>사진 {files.length} / {MAX_ANALYSIS_PHOTOS}</strong><span>{files.length === MAX_ANALYSIS_PHOTOS ? "사진을 최대 10장까지 등록했어요." : ready ? "모디자가 공간을 살펴볼 준비가 되었어요." : `사진을 ${remaining}장 더 올리면 분석할 수 있어요.`}</span>{ready && <CheckCircle2 />}</div>
      <label className="upload space-assistant-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); add(Array.from(event.dataTransfer.files)); }}><ImagePlus /><b>{files.length ? "사진 더 추가하기" : "공간 사진 선택"}</b><span>최소 5장·최대 10장 · JPG, PNG, WebP · 장당 10MB 이하</span><input hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { add(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></label>
      {!!previews.length && <div className="space-assistant-preview-grid">{previews.map((preview, index) => <article className="space-assistant-preview" key={`${files[index].name}-${files[index].size}-${files[index].lastModified}`}><Image src={preview} alt={`공간 사진 ${index + 1}`} fill unoptimized />{index === 0 && <span className="thumbnail-badge"><Star />대표 사진</span>}<div className="photo-actions"><button type="button" disabled={index === 0} aria-label="앞으로 이동" onClick={() => move(index, -1)}><ArrowUp /></button><button type="button" disabled={index === files.length - 1} aria-label="뒤로 이동" onClick={() => move(index, 1)}><ArrowDown /></button>{index > 0 && <button type="button" aria-label="대표 사진 지정" onClick={() => makeThumbnail(index)}><Star /></button>}<button type="button" aria-label="사진 삭제" onClick={() => remove(index)}><Trash2 /></button></div></article>)}</div>}
      {files.length < MIN_ANALYSIS_PHOTOS && <p className="analysis-disabled-reason">사진을 최소 5장 올리면 모디자가 분석할 수 있어요.</p>}
      {error && <p className="error-summary" role="alert">{error}</p>}
      {!analysis && <div className="assistant-actions"><Link className="btn btn-ghost" href="/spaces/register"><ArrowLeft />이전</Link><button type="button" className="btn btn-primary" disabled={!ready || loading} onClick={() => void analyze()}>{loading ? <><LoaderCircle className="spin" />모디자가 공간을 살펴보고 있어요.</> : <><Sparkles />사진 분석하기</>}</button></div>}
      {loading && <p className="muted analysis-loading-copy">사진 속 시설과 분위기를 정리하고 있습니다.</p>}
      {analysis && photosChanged && <aside className="photo-change-notice"><div><strong>사진 구성이 변경되었어요.</strong><p>현재 분석 결과를 유지하거나 변경된 사진으로 다시 분석할 수 있습니다.</p></div><div><button type="button" className="btn btn-ghost btn-small" onClick={() => setPhotosChanged(false)}>현재 결과 유지</button><button type="button" className="btn btn-primary btn-small" disabled={!ready || loading} onClick={() => void analyze(true)}>{loading ? "분석 중..." : "다시 분석하기"}</button></div></aside>}
    </section>
    <PhotoGuide />
    <AnalysisScope />
    {analysis && <><aside className="panel assisted-ready"><Sparkles /><div><h2>모디자가 사진을 보고 내용을 먼저 정리했어요.</h2><p>실제 공간과 다른 내용이 있다면 자유롭게 수정해주세요.</p></div></aside><SpaceForm assisted suggested={suggested} suggestedVersion={analysisVersion} controlledFiles={files} hidePhotoSection /></>}
  </div>;
}
