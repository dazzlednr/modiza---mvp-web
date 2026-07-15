import { requireRole } from "@/lib/auth/access";

export default async function SpaceRegisterLayout({ children }: { children: React.ReactNode }) {
  await requireRole("space_host");
  return children;
}
