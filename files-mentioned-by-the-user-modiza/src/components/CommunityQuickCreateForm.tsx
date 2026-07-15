"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Users } from "lucide-react";

export function CommunityQuickCreateForm({
  space,
}: {
  space: { id: string; name: string; region: string; maxCapacity: number };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [capacity, setCapacity] = useState(Math.min(10, space.maxCapacity));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, meetingDate, capacity, spaceId: space.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.push(`/communities/${result.slug}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "모임을 만들지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="panel" style={{ background: "var(--primary-light)" }}>
        <p className="eyebrow">선택된 공간</p>
        <h3 style={{ margin: "4px 0" }}>{space.name}</h3>
        <div className="meta">
          <span><MapPin size={14} /> {space.region}</span>
          <span><Users size={14} /> 최대 {space.maxCapacity}명</span>
        </div>
      </div>
      <label>
        커뮤니티 이름
        <input className="field" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="grid form-grid">
        <label>
          모임 날짜
          <input className="field" type="date" required value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
        </label>
        <label>
          모집 인원
          <input className="field" type="number" min="2" max={space.maxCapacity} required value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
        </label>
      </div>
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}
      <button className="btn btn-primary" disabled={loading}>
        {loading ? "모임을 만들고 있어요..." : "이 공간으로 모임 만들기"}
      </button>
    </form>
  );
}
