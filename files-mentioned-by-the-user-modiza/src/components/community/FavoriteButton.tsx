"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const eventName = "modiza:favorite-changed";

export function FavoriteButton({ communityId, initialFavorite, authenticated, returnTo, compact = false }: {
  communityId: string; initialFavorite: boolean; authenticated: boolean; returnTo: string; compact?: boolean;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ communityId: string; favorite: boolean }>).detail;
      if (detail.communityId === communityId) setFavorite(detail.favorite);
    };
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, [communityId]);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const next = !favorite;
    const response = await fetch(`/api/favorites/${communityId}`, { method: next ? "POST" : "DELETE" });
    if (response.status === 401) {
      alert("\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
    } else if (response.ok) {
      setFavorite(next);
      window.dispatchEvent(new CustomEvent(eventName, { detail: { communityId, favorite: next } }));
      router.refresh();
    } else alert((await response.json()).message ?? "\uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.");
    setLoading(false);
  }

  return <button type="button" data-authenticated={authenticated} className={`favorite-button ${compact ? "compact" : ""} ${favorite ? "active" : ""}`} aria-label={favorite ? "\uAD00\uC2EC \uCEE4\uBBA4\uB2C8\uD2F0 \uD574\uC81C" : "\uAD00\uC2EC \uCEE4\uBBA4\uB2C8\uD2F0 \uC800\uC7A5"} aria-pressed={favorite} disabled={loading} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggle(); }}><Heart fill={favorite ? "currentColor" : "none"} /></button>;
}
