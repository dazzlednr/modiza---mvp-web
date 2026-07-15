"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  LoaderCircle,
  MapPin,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  meetingTypes,
  recommendationFacilities,
  recommendationMoods,
  recommendationRegions,
  SpaceRecommendationInputSchema,
  type SpaceRecommendationInput,
  type SpaceRecommendationResponse,
} from "@/types/space-recommendation";

const storageKey = "modiza:last-space-recommendation";
const initial: SpaceRecommendationInput = {
  meetingType: "독서",
  capacity: 10,
  region: "중구",
  budget: 50000,
  facilities: [],
  moods: [],
  date: "",
};

export default function SpaceRecommendationPage() {
  const [form, setForm] = useState<SpaceRecommendationInput>(initial);
  const [response, setResponse] = useState<SpaceRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    let frame = 0;
    try {
      const parsed = SpaceRecommendationInputSchema.safeParse(JSON.parse(saved));
      if (parsed.success) {
        frame = requestAnimationFrame(() => setForm(parsed.data));
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggle(
    key: "facilities" | "moods",
    value: SpaceRecommendationInput[typeof key][number],
  ) {
    const values = form[key] as string[];
    setForm({
      ...form,
      [key]: values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = SpaceRecommendationInputSchema.safeParse(form);
    if (!parsed.success) {
      setError("예상 인원, 지역, 예산과 이용 날짜를 확인해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      localStorage.setItem(storageKey, JSON.stringify(parsed.data));
      const result = await fetch("/api/space-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.message);
      setResponse(payload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "공간 추천을 완료하지 못했어요.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 1060 }}>
        <p className="eyebrow">Space match</p>
        <h1 className="section-title">우리 모임에 맞는 공간 찾기</h1>
        <p className="muted">
          조건을 알려주시면 실제 등록 공간을 기준으로 가장 잘 맞는 곳을 찾아드려요.
        </p>

        <form className="panel form" style={{ marginTop: 28 }} onSubmit={submit}>
          <div className="grid form-grid">
            <label>
              모임 유형
              <select
                className="field"
                value={form.meetingType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    meetingType: event.target.value as SpaceRecommendationInput["meetingType"],
                  })
                }
              >
                {meetingTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              예상 인원
              <input
                className="field"
                type="number"
                min="1"
                required
                value={form.capacity}
                onChange={(event) =>
                  setForm({ ...form, capacity: Number(event.target.value) })
                }
              />
            </label>
            <label>
              희망 지역
              <select
                className="field"
                value={form.region}
                onChange={(event) =>
                  setForm({
                    ...form,
                    region: event.target.value as SpaceRecommendationInput["region"],
                  })
                }
              >
                {recommendationRegions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>
            <label>
              시간당 최대 예산
              <input
                className="field"
                type="number"
                min="0"
                step="1000"
                required
                value={form.budget}
                onChange={(event) =>
                  setForm({ ...form, budget: Number(event.target.value) })
                }
              />
            </label>
            <label>
              이용 날짜
              <input
                className="field"
                type="date"
                required
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
          </div>

          <div>
            <strong>필수 시설</strong>
            <div className="category-row" style={{ marginTop: 8 }}>
              {recommendationFacilities.map((facility) => (
                <button
                  type="button"
                  className={`category ${form.facilities.includes(facility) ? "active" : ""}`}
                  key={facility}
                  onClick={() => toggle("facilities", facility)}
                >
                  {facility}
                </button>
              ))}
            </div>
          </div>

          <div>
            <strong>원하는 분위기</strong>
            <div className="category-row" style={{ marginTop: 8 }}>
              {recommendationMoods.map((mood) => (
                <button
                  type="button"
                  className={`category ${form.moods.includes(mood) ? "active" : ""}`}
                  key={mood}
                  onClick={() => toggle("moods", mood)}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: "var(--error)" }}>{error}</p>}
          <div className="meta">
            <button className="btn btn-primary" disabled={loading}>
              {loading ? <LoaderCircle /> : <Sparkles size={17} />}
              {loading
                ? "조건에 맞는 공간을 찾고 있습니다."
                : "조건에 맞는 공간 보기"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setForm(initial);
                setResponse(null);
                setError("");
                localStorage.removeItem(storageKey);
              }}
            >
              초기화
            </button>
          </div>
        </form>

        {response && (
          <div style={{ marginTop: 48 }}>
            <h2>추천 공간 {response.results.length}곳</h2>
            {!response.results.length ? (
              <div className="empty" style={{ marginTop: 20 }}>
                <h3>조건에 맞는 공간이 아직 없어요</h3>
                <p className="muted">
                  인원, 필수 시설 또는 이용 날짜 조건을 조정해 보세요.
                </p>
              </div>
            ) : (
              <div className="grid" style={{ marginTop: 20 }}>
                {response.results.map((space) => (
                  <article className="card" key={space.id}>
                    <div
                      className="recommendation-card-grid"
                      style={{
                        display: "grid",
                      }}
                    >
                      <div className="cover" style={{ height: "100%" }}>
                        {space.thumbnailUrl && (
                          <Image
                            src={space.thumbnailUrl}
                            alt={space.name}
                            fill
                            sizes="(max-width: 700px) 100vw, 340px"
                          />
                        )}
                      </div>
                      <div className="card-body">
                        <div className="meta" style={{ justifyContent: "space-between" }}>
                          <span className="tag">추천 점수 {space.score}점</span>
                          <span>
                            <MapPin size={14} /> {space.region}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 24, marginBottom: 8 }}>{space.name}</h3>
                        <div className="meta">
                          <span>
                            <Wallet size={14} /> 시간당 {space.pricePerHour.toLocaleString("ko-KR")}원
                          </span>
                          <span>
                            <Users size={14} /> 최대 {space.maxCapacity}명
                          </span>
                          <span>
                            <CalendarDays size={14} /> 선택일 이용 가능
                          </span>
                        </div>
                        <div className="meta" style={{ marginTop: 14 }}>
                          {space.facilities.slice(0, 5).map((facility) => (
                            <span className="tag" key={facility}>{facility}</span>
                          ))}
                          {space.moods.slice(0, 3).map((mood) => (
                            <span className="tag" key={mood}>{mood}</span>
                          ))}
                        </div>
                        {space.reason && <p style={{ marginTop: 18 }}>{space.reason}</p>}
                        <div style={{ marginTop: 14 }}>
                          {space.evidence.map((item) => (
                            <p className="muted" style={{ margin: "3px 0" }} key={item}>
                              <Check size={14} style={{ color: "var(--success)", verticalAlign: -2 }} /> {item}
                            </p>
                          ))}
                        </div>
                        <div className="meta" style={{ marginTop: 20 }}>
                          <Link className="btn btn-ghost" href={`/spaces/${space.slug}`}>
                            자세히 보기
                          </Link>
                          <Link
                            className="btn btn-primary"
                            href={`/communities/register?spaceId=${space.id}&activityType=${encodeURIComponent(form.meetingType)}&capacity=${form.capacity}&region=${encodeURIComponent(form.region)}&date=${form.date}`}
                          >
                            이 공간으로 모임 만들기
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {response.exclusions && response.exclusions.length > 0 && (
              <details className="panel" style={{ marginTop: 24 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  개발자 모드: 추천 제외 이유
                </summary>
                {response.exclusions.map((item) => (
                  <p className="muted" key={item.spaceId}>
                    <b>{item.spaceName}</b>: {item.reasons.join(", ")}
                  </p>
                ))}
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
