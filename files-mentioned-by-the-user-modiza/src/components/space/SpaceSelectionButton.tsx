"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SpaceSelectionButton({
  communityId,
  spaceId,
}: {
  communityId: string;
  spaceId: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function select() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/communities/${communityId}/space-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "공간 신청을 만들지 못했어요.");
      router.push(`/dashboard/communities/space-requests?requestId=${result.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "공간 신청을 만들지 못했어요.");
      setSaving(false);
    }
  }

  return <div className="form">
    {error && <p className="error-summary" role="alert">{error}</p>}
    <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void select()}>
      {saving ? <><LoaderCircle />신청을 만드는 중...</> : <><MapPin />이 공간 선택하기</>}
    </button>
  </div>;
}
