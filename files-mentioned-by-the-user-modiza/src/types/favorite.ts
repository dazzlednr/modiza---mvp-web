import type { Community } from "@/types/community";

export type CommunityFavorite = {
  id: string;
  userId: string;
  communityId: string;
  createdAt: string;
  community: Community;
};

export type RecommendedCommunity = {
  community: Community;
  score: number;
  reasons: string[];
};
