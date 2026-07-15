import { requireUser } from "@/lib/auth/access";

export default async function MyPageLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
