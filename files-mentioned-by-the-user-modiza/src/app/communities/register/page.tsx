import { CommunityForm } from "@/components/community/CommunityForm";
import { createAuthServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveSpaces } from "@/repositories/spaceRepository";
import type { CommunityFormValues } from "@/types/community";

export default async function Page({ searchParams }: { searchParams: Promise<{ spaceId?: string; activityType?: string; capacity?: string; region?: string; date?: string }> }) {
  const query = await searchParams;
  const spaces = await getActiveSpaces(await createAuthServerSupabaseClient());
  const selected = spaces.find((space) => space.id === query.spaceId);
  const categories = ["독서", "영화", "음악", "글쓰기", "사진", "운동", "네트워킹", "스터디", "전시·공연", "취미", "기타"];
  const suggested: Partial<CommunityFormValues> = { linkedSpaceId: selected?.id ?? null, category: (categories.includes(query.activityType ?? "") ? query.activityType : "기타") as CommunityFormValues["category"], capacity: Math.min(Number(query.capacity) || 10, selected?.maxCapacity ?? 1000), mainRegion: query.region ?? selected?.mainRegion ?? "", detailedRegion: selected?.detailedRegion ?? "", nextMeetingAt: query.date ? `${query.date}T19:00` : "" };
  return <section className="section"><div className="container" style={{ maxWidth: 960 }}><p className="eyebrow">Start a community</p><h1 className="section-title">새 커뮤니티 등록</h1><p className="muted">필요한 내용을 채우고 임시 저장하거나 바로 공개할 수 있어요.</p><CommunityForm spaces={spaces.map((space) => ({ id: space.id, name: space.name, mainRegion: space.mainRegion, address: space.address, maxCapacity: space.maxCapacity, thumbnailUrl: space.thumbnailUrl }))} suggested={suggested} /></div></section>;
}
