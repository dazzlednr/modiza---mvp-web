"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type {
  SpaceAnalysisResult,
  StoredSpaceAnalysis,
} from "@/types/space-analysis";

type ErrorPayload = {
  message?: string;
};

function getErrorMessage(payload: ErrorPayload) {
  return payload.message ?? "AI 분석에 실패했어요.";
}

export function SpaceAnalysisPanel({ spaceId }: { spaceId: string }) {
  const [result, setResult] = useState<SpaceAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cached, setCached] = useState(false);

  useEffect(() => {
    fetch(`/api/spaces/${spaceId}/analysis`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: StoredSpaceAnalysis | null) => {
        if (data) setResult(data.analysis);
      });
  }, [spaceId]);

  async function analyze(force = false) {
    if (
      force &&
      result &&
      !confirm("기존 분석 결과를 덮어쓰고 다시 분석할까요?")
    ) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/spaces/${spaceId}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await response.json()) as ErrorPayload &
        StoredSpaceAnalysis & { cached?: boolean };
      if (!response.ok) throw new Error(getErrorMessage(data));
      setResult(data.analysis);
      setCached(Boolean(data.cached));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "AI 분석에 실패했어요.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/spaces/${spaceId}/analysis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!response.ok) {
        throw new Error(getErrorMessage(await response.json()));
      }
      alert("분석 결과를 공간 정보에 저장했어요.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "저장에 실패했어요.",
      );
    } finally {
      setSaving(false);
    }
  }

  const list = (
    key: "moods" | "interiorStyles" | "activities",
    title: string,
  ) => (
    <label>
      {title}
      <input
        className="field"
        value={result?.[key].join(", ") ?? ""}
        onChange={(event) =>
          result &&
          setResult({
            ...result,
            [key]: event.target.value
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          })
        }
      />
    </label>
  );

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="meta" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">OpenAI Vision</p>
          <h2>AI 공간 분석</h2>
        </div>
        <button
          className="btn btn-primary"
          disabled={loading}
          onClick={() => analyze(Boolean(result))}
        >
          {loading ? (
            <>
              <LoaderCircle /> AI가 공간을 분석하고 있습니다.
            </>
          ) : (
            <>
              <Sparkles /> {result ? "다시 분석" : "AI 분석하기"}
            </>
          )}
        </button>
      </div>

      {cached && (
        <p className="tag">사진이 변경되지 않아 저장된 결과를 불러왔어요.</p>
      )}
      {error && (
        <pre
          style={{
            color: "var(--error)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: "inherit",
          }}
        >
          {error}
        </pre>
      )}

      {result && (
        <div className="form">
          <label>
            공간 유형
            <input
              className="field"
              value={result.spaceType}
              onChange={(event) =>
                setResult({ ...result, spaceType: event.target.value })
              }
            />
          </label>
          {list("moods", "분위기")}
          {list("interiorStyles", "인테리어 스타일")}
          {list("activities", "적합한 활동")}
          <label>
            보이는 시설
            <input
              className="field"
              value={result.visibleFacilities.map((item) => item.name).join(", ")}
              onChange={(event) =>
                setResult({
                  ...result,
                  visibleFacilities: event.target.value
                    .split(",")
                    .map((name) => ({ name: name.trim(), confidence: 0.5 }))
                    .filter((item) => item.name),
                })
              }
            />
          </label>
          <div className="panel">
            <b>사진상 예상 적정 인원</b>
            <p>
              {result.estimatedCapacity.min}~{result.estimatedCapacity.max}명 ·
              신뢰도 {Math.round(result.estimatedCapacity.confidence * 100)}%
            </p>
          </div>
          <label>
            공간 소개
            <textarea
              className="field"
              rows={5}
              value={result.description}
              onChange={(event) =>
                setResult({ ...result, description: event.target.value })
              }
            />
          </label>
          <div>
            <b>확인 필요</b>
            {result.warnings.map((warning, index) => (
              <p className="muted" key={`${warning}-${index}`}>
                · {warning}
              </p>
            ))}
          </div>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={save}
          >
            {saving ? "저장 중..." : "분석 결과 저장"}
          </button>
        </div>
      )}
    </section>
  );
}
