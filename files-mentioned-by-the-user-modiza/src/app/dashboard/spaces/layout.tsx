import { getRequestDestination, requireRole } from "@/lib/auth/access";

export default async function SpacesDashboardLayout({ children }: { children: React.ReactNode }) {
  const destination = await getRequestDestination("/dashboard/spaces");
  const isRecommendation = destination.startsWith("/dashboard/spaces/recommend");
  await requireRole(isRecommendation ? "community_host" : "space_host", destination);
  return children;
}
