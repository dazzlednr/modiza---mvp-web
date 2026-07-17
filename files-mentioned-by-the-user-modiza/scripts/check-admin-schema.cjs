const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[match[1]] = value;
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function check(table, configure = (query) => query) {
  const result = await configure(db.from(table).select("*", { count: "exact", head: true }));
  return result.error
    ? { table, ok: false, code: result.error.code, message: result.error.message }
    : { table, ok: true, count: result.count ?? 0 };
}

Promise.all([
  check("profiles"),
  check("space_host_applications"),
  check("spaces"),
  check("communities"),
  check("reports"),
  check("admin_audit_logs"),
]).then(async (results) => {
  const stats = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("space_host_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("spaces").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db.from("communities").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db.from("reports").select("id", { count: "exact", head: true }).in("status", ["pending", "reviewing"]),
  ]);
  const columns = await Promise.all([
    db.from("spaces").select("id,deleted_at").limit(1),
    db.from("communities").select("id,deleted_at").limit(1),
  ]);
  const pages = await Promise.all([
    db.from("profiles").select("id,email,nickname,roles,account_status,created_at").order("created_at", { ascending: false }),
    db.from("space_host_applications").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    db.from("reports").select("*").order("created_at", { ascending: false }),
  ]);
  console.log(JSON.stringify(results, null, 2));
  console.log(JSON.stringify(stats.map((result, index) => ({
    query: ["members", "pendingHosts", "spacesNotDeleted", "communitiesNotDeleted", "pendingReports"][index],
    count: result.count,
    error: result.error && { code: result.error.code, message: result.error.message },
  })), null, 2));
  console.log(JSON.stringify(columns.map((result, index) => ({
    query: ["spaceColumns", "communityColumns"][index],
    data: result.data,
    error: result.error && { code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint },
  })), null, 2));
  console.log(JSON.stringify(pages.map((result, index) => ({
    query: ["membersPage", "hostApplicationsPage", "reportsPage"][index],
    rows: result.data?.length ?? null,
    error: result.error && { code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint },
  })), null, 2));
  if (results.some((result) => !result.ok) || stats.some((result) => result.error)) process.exitCode = 1;
});
