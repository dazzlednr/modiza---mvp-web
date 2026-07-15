import { requireUser } from "@/lib/auth/access";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard");
  return children;
}
