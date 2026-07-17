const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

function loadLocalEnv() {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("EMAIL_REQUIRED");
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_ADMIN_ENV_MISSING");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const found = await db.from("profiles").select("id,email,roles").eq("email", email).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) throw new Error("PROFILE_NOT_FOUND");

  const roles = Array.from(new Set([...(found.data.roles || ["member"]), "admin"]));
  const updated = await db.from("profiles").update({ roles }).eq("id", found.data.id).select("email,roles").single();
  if (updated.error) throw updated.error;
  console.log(JSON.stringify({ ok: true, email: updated.data.email, roles: updated.data.roles }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, code: error.code || null }));
  process.exit(1);
});
