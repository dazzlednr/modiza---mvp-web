import Link from "next/link";
import {requireAdmin} from "@/lib/auth/access";

const menus=[
  ["/admin","대시보드"],
  ["/admin/host-applications","공간 운영자 자격"],
  ["/admin/space-verifications","공간 인증 관리"],
  ["/admin/spaces","공간 공개 관리"],
  ["/admin/communities","커뮤니티 관리"],
  ["/admin/members","회원 관리"],
  ["/admin/reports","신고 관리"],
  ["/admin/audit","관리자 활동 기록"],
];

export default async function AdminLayout({children}:{children:React.ReactNode}){
  await requireAdmin();
  return <section className="section dashboard-shell"><div className="container admin-layout"><aside className="panel admin-nav"><p className="eyebrow">MODIZA Admin</p><h2>관리자 페이지</h2>{menus.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</aside><div className="admin-content">{children}</div></div></section>;
}
