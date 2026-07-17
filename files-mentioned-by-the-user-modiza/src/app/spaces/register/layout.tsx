import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { hasAnyRole } from "@/lib/auth/roles";

export default async function SpaceRegisterLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/spaces/register");
  if (!hasAnyRole(profile, ["space_host", "admin"])) redirect("/space-host/apply");
  return children;
}
