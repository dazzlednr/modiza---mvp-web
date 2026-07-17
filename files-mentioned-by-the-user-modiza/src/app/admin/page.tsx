import Link from "next/link";
import { requireAdminDb } from "@/lib/auth/admin";
import { getAdminStats } from "@/repositories/adminRepository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stats = await getAdminStats(await requireAdminDb());
  const cards = [
    ["\uC804\uCCB4 \uD68C\uC6D0", stats.members, "/admin/members"],
    ["\uC6B4\uC601\uC790 \uC778\uC99D \uB300\uAE30", stats.pendingHosts, "/admin/host-applications?status=pending"],
    ["\uB4F1\uB85D \uACF5\uAC04", stats.spaces, "/admin/spaces"],
    ["\uB4F1\uB85D \uCEE4\uBBA4\uB2C8\uD2F0", stats.communities, "/admin/communities"],
    ["\uCC98\uB9AC \uB300\uAE30 \uC2E0\uACE0", stats.pendingReports, "/admin/reports?status=pending"],
  ] as const;
  return <><div className="page-heading"><p className="eyebrow">Overview</p><h1 className="section-title">{"\uAD00\uB9AC\uC790 \uB300\uC2DC\uBCF4\uB4DC"}</h1><p className="muted">{"\uD604\uC7AC \uC11C\uBE44\uC2A4 \uC6B4\uC601 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694."}</p></div><div className="admin-stat-grid">{cards.map(([label,value,href])=><Link className="dashboard-stat" href={href} key={label}><span>{label}</span><strong>{value}</strong></Link>)}</div></>;
}
