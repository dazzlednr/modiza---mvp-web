"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { communityCategories, type Community } from "@/types/community";
import { representativeRegions } from "@/constants/regions";
import { formatRegion } from "@/constants/taxonomy";
import { calculateRecruitmentStatus, recruitmentLabels } from "@/lib/community/recruitment";
import { filterCommunities } from "@/utils/filter-communities";

function format(value?: string | null) { return value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "다음 일정 준비 중"; }

export function CommunityCard({ c }: { c: Community }) {
  const status = calculateRecruitmentStatus(c);
  return <article className="card"><div className="cover"><Image src={c.thumbnailUrl || "/community-placeholder.svg"} alt={c.name} fill sizes="(max-width:600px) 100vw, 25vw" /></div><div className="card-body"><div className="meta" style={{ justifyContent: "space-between" }}><span className="tag">{c.category === "기타" && c.customCategory ? c.customCategory : c.category}</span><span className="tag status">{recruitmentLabels[status]}</span></div><h3 style={{ margin: "12px 0 8px", fontSize: 20 }}>{c.name}</h3><p className="muted" style={{ minHeight: 52 }}>{c.shortDescription}</p><div className="meta" style={{ display: "grid", gap: 8 }}><span><MapPin size={15} />{formatRegion(c.mainRegion, c.detailedRegion, c.customRegion)}</span><span style={{ color: "var(--text-primary)", fontWeight: 600 }}><CalendarDays size={15} color="var(--primary)" />{format(c.nextMeetingAt)}</span></div><Link href={`/communities/${c.slug}`} style={{ display: "inline-block", color: "var(--primary)", fontWeight: 600, marginTop: 20 }}>자세히 보기 →</Link></div></article>;
}
export function CommunityGrid({ items }: { items: Community[] }) { return <div className="grid cards">{items.map((community) => <CommunityCard key={community.id} c={community} />)}</div>; }

export function CommunityExplorer({ items, compact = false, initialRegion = "전체 보기", initialCategory = "전체" }: { items: Community[]; compact?: boolean; initialRegion?: string; initialCategory?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [region, setRegion] = useState(initialRegion);
  const [status, setStatus] = useState(initialCategory && initialCategory !== "전체" ? "recruiting" : "전체");
  const list = useMemo(() => filterCommunities({ communities: items, searchQuery: query, category, region, status }), [items, query, category, region, status]);
  function selectCategory(next: string) { setCategory(next); if (next !== "전체") setStatus("recruiting"); if (!compact) router.replace(next === "전체" ? "/communities" : `/communities?category=${encodeURIComponent(next)}`, { scroll: false }); }
  return <><div id="categories" className="category-row">{["전체", ...communityCategories].map((item) => <button type="button" className={`category ${category === item ? "active" : ""}`} key={item} onClick={() => selectCategory(item)}>{item}</button>)}</div><label style={{ position: "relative", margin: "16px 0 8px" }}><span className="sr-only">커뮤니티 검색</span><Search size={18} style={{ position: "absolute", left: 16, top: 15 }} /><input aria-label="커뮤니티 검색" className="field" style={{ paddingLeft: 46 }} placeholder="커뮤니티명, 카테고리, 지역을 검색해 보세요" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{!compact && <div className="filters" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><select className="field" value={category} onChange={(event) => selectCategory(event.target.value)}>{["전체", ...communityCategories].map((item) => <option key={item}>{item}</option>)}</select><select className="field" value={region} onChange={(event) => setRegion(event.target.value)}><option>전체 보기</option>{representativeRegions.map((item) => <option key={item}>{item}</option>)}</select><select className="field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="전체">모든 상태</option><option value="recruiting">모집 중</option><option value="full">모집 완료</option><option value="closed">모집 마감</option><option value="completed">진행 완료</option></select></div>}<p className="muted">{list.length}개의 커뮤니티를 찾았어요</p>{list.length ? <CommunityGrid items={compact ? list.slice(0, 4) : list} /> : <div className="empty"><h3>검색 조건에 맞는 커뮤니티가 아직 없어요</h3><p className="muted">다른 카테고리나 지역으로 다시 찾아보세요.</p></div>}</>;
}
