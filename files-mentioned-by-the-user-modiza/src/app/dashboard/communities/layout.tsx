import { requireRole } from "@/lib/auth/access";

export default async function CommunityDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRole("community_host");
  return children;
}
