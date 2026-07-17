import { matchesRegion } from "@/constants/regions";
import type { Community } from "@/types/community";

export type CommunityFilterInput = {
  communities: Community[];
  searchQuery?: string;
  category?: string;
  region?: string;
};

export function filterCommunities(input: CommunityFilterInput) {
  const words = (input.searchQuery ?? "")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .split(/\s+/)
    .filter(Boolean);

  return input.communities.filter((community) => {
    const haystack = [
      community.name,
      community.shortDescription,
      community.description,
      community.category,
      community.customCategory,
      community.mainRegion,
      community.detailedRegion,
      community.customRegion,
      ...community.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ko-KR");

    return (
      (!input.category || input.category === "전체" || community.category === input.category) &&
      matchesRegion(
        `${community.detailedRegion} ${community.mainRegion}`,
        input.region ?? "",
        community.customRegion ?? "",
      ) &&
      words.every((word) => haystack.includes(word))
    );
  });
}
