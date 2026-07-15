import type { SupabaseClient } from "@supabase/supabase-js";

type CachedReasonRow = {
  space_id: string;
  reason: string;
};

export async function getCachedRecommendationReasons(
  db: SupabaseClient,
  conditionHash: string,
  spaceIds: string[],
) {
  const { data, error } = await db
    .from("space_recommendation_reasons")
    .select("space_id,reason")
    .eq("condition_hash", conditionHash)
    .in("space_id", spaceIds);
  if (error) throw error;
  return new Map(
    ((data ?? []) as CachedReasonRow[]).map((row) => [row.space_id, row.reason]),
  );
}

export async function saveRecommendationReasons(
  db: SupabaseClient,
  conditionHash: string,
  reasons: Array<{ spaceId: string; reason: string }>,
) {
  if (!reasons.length) return;
  const { error } = await db.from("space_recommendation_reasons").upsert(
    reasons.map((item) => ({
      condition_hash: conditionHash,
      space_id: item.spaceId,
      reason: item.reason,
    })),
    { onConflict: "condition_hash,space_id" },
  );
  if (error) throw error;
}
