"use client";

import { createBrowserClient } from "@supabase/ssr";

let instance: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase public environment variables are missing.");
  }
  return instance ??= createBrowserClient(url, key);
}
