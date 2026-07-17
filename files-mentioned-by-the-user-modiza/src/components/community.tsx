"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FavoriteButton } from "@/components/community/FavoriteButton";
import { communityCategories, type Community } from "@/types/community";
import { representativeRegions } from "@/constants/regions";
import { formatRegion } from "@/constants/taxonomy";
import { calculateRecruitmentStatus, recruitmentLabels } from "@/lib/community/recruitment";
import { filterCommunities } from "@/utils/filter-communities";

function formatMeeting(value?: string | null) {
  if (!value) return "\uB2E4\uC74C \uC77C\uC815 \uC900\uBE44 \uC911";
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return "\uB2E4\uC74C \uC77C\uC815 \uC900\uBE44 \uC911";
  const korea = new Date(source.getTime() + 9 * 60 * 60 * 1000);
  const weekdays = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];
  const hour24 = korea.getUTCHours();
  return `${korea.getUTCMonth() + 1}\uC6D4 ${korea.getUTCDate()}\uC77C (${weekdays[korea.getUTCDay()]}) ${hour24 < 12 ? "\uC624\uC804" : "\uC624\uD6C4"} ${hour24 % 12 || 12}:${String(korea.getUTCMinutes()).padStart(2, "0")}`;
}

type CommunityCardVariant = "default" | "dashboard";

export function CommunityCard({
  c,
  favorite = false,
  authenticated = false,
  reason,
  variant = "default",
}: {
  c: Community;
  favorite?: boolean;
  authenticated?: boolean;
  reason?: string;
  variant?: CommunityCardVariant;
}) {
  const status = calculateRecruitmentStatus(c);
  const dashboard = variant === "dashboard";
  return <article className={`card community-card ${dashboard ? "community-card-dashboard" : ""}`}>
    <div className="cover community-card-cover"><Image src={c.thumbnailUrl || "/community-placeholder.svg"} alt={c.name} fill sizes={dashboard ? "(max-width:700px) 82vw, (max-width:1020px) 50vw, 25vw" : "(max-width:600px) 100vw, 25vw"} /><FavoriteButton communityId={c.id} initialFavorite={favorite} authenticated={authenticated} returnTo={`/communities/${c.slug}`} compact /></div>
    <div className="card-body community-card-body">
      <div className="meta community-card-badges"><span className="tag">{c.customCategory || c.category}</span><span className="tag status">{recruitmentLabels[status]}</span></div>
      <h3 className="community-card-title">{c.name}</h3>
      {!dashboard && <p className="muted community-card-description">{c.shortDescription}</p>}
      <div className="meta community-card-meta"><span><MapPin size={15} />{formatRegion(c.mainRegion, c.detailedRegion, c.customRegion)}</span><span className="community-card-schedule"><CalendarDays size={15} color="var(--primary)" />{formatMeeting(c.nextMeetingAt)}</span></div>
      {reason && <p className="recommendation-reason">{reason}</p>}
      <Link className="community-card-link" href={`/communities/${c.slug}`}>{"\uC790\uC138\uD788 \uBCF4\uAE30 \u2192"}</Link>
    </div>
  </article>;
}

export function CommunityGrid({
  items,
  favoriteIds = [],
  authenticated = false,
  reasons = {},
  variant = "default",
  className = "",
}: {
  items: Community[];
  favoriteIds?: string[];
  authenticated?: boolean;
  reasons?: Record<string, string>;
  variant?: CommunityCardVariant;
  className?: string;
}) {
  const favorites = new Set(favoriteIds);
  return <div className={`grid cards ${className}`.trim()}>{items.map((community) => <CommunityCard key={community.id} c={community} favorite={favorites.has(community.id)} authenticated={authenticated} reason={reasons[community.id]} variant={variant} />)}</div>;
}

type CommunitySort = "recommended" | "latest" | "upcoming";

function sortCommunities(items: Community[], sort: CommunitySort) {
  if (sort === "recommended") return items;

  return [...items].sort((left, right) => {
    if (sort === "latest") {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    const leftMeeting = left.nextMeetingAt ? new Date(left.nextMeetingAt).getTime() : Number.POSITIVE_INFINITY;
    const rightMeeting = right.nextMeetingAt ? new Date(right.nextMeetingAt).getTime() : Number.POSITIVE_INFINITY;
    return leftMeeting - rightMeeting;
  });
}

export function CommunityExplorer({ items, compact = false, initialRegion = "전체 보기", initialCategory = "전체", favoriteIds = [], authenticated = false }: { items: Community[]; compact?: boolean; initialRegion?: string; initialCategory?: string; favoriteIds?: string[]; authenticated?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [region, setRegion] = useState(initialRegion);
  const [sort, setSort] = useState<CommunitySort>("recommended");
  const list = useMemo(() => {
    const filtered = filterCommunities({ communities: items, searchQuery: query, category, region });
    return sortCommunities(filtered, sort);
  }, [items, query, category, region, sort]);

  function selectCategory(next: string) {
    setCategory(next);
    if (!compact) router.replace(next === "전체" ? "/communities" : `/communities?category=${encodeURIComponent(next)}`, { scroll: false });
  }

  return <>
    {compact && <div id="categories" className="category-row">{["전체", ...communityCategories].map((item) => <button type="button" className={`category ${category === item ? "active" : ""}`} key={item} onClick={() => selectCategory(item)}>{item}</button>)}</div>}
    <label style={{ position: "relative", margin: "16px 0 8px" }}><span className="sr-only">커뮤니티 검색</span><Search size={18} style={{ position: "absolute", left: 16, top: 15 }} /><input aria-label="커뮤니티 검색" className="field" style={{ paddingLeft: 46 }} type="search" name="community-search" placeholder="관심 있는 모임을 찾아보세요." value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="search" /></label>
    {!compact && <div className="filters" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
      <select aria-label="카테고리 필터" className="field" value={category} onChange={(event) => selectCategory(event.target.value)}><option value="전체">카테고리 전체</option>{communityCategories.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="지역 필터" className="field" value={region} onChange={(event) => setRegion(event.target.value)}><option value="전체 보기">지역 전체</option>{representativeRegions.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="정렬 기준" className="field" value={sort} onChange={(event) => setSort(event.target.value as CommunitySort)}><option value="recommended">추천순</option><option value="latest">최신순</option><option value="upcoming">가까운 일정순</option></select>
    </div>}
    <p className="muted">{list.length}개의 커뮤니티를 찾았어요.</p>
    {list.length ? <CommunityGrid items={compact ? list.slice(0, 4) : list} favoriteIds={favoriteIds} authenticated={authenticated} /> : <div className="empty"><h3>검색 조건에 맞는 커뮤니티가 아직 없어요.</h3></div>}
  </>;
}
