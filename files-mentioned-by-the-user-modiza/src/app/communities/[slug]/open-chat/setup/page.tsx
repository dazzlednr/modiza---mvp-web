import { OpenChatManager } from "@/components/community/OpenChatManager";
import { requireUser } from "@/lib/auth/access";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const requestedNext = (await searchParams).next ?? "";
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "";
  await requireUser(`/communities/${slug}/open-chat/setup`);
  return <section className="section"><div className="container" style={{ maxWidth: 820 }}><OpenChatManager communityId={slug} setup nextPath={nextPath} /></div></section>;
}
