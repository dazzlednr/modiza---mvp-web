import "server-only";

import { requireAdmin } from "@/lib/auth/access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function requireAdminDb() {
  await requireAdmin();
  return createAdminSupabaseClient();
}
