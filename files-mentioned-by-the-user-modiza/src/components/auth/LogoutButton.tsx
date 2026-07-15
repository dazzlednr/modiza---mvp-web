"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await createBrowserSupabaseClient().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      {loading ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}
