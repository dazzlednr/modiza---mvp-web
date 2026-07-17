export const userRoles = [
  "member",
  "community_host",
  "host_pending",
  "space_host",
  "admin",
] as const;

export type UserRole = (typeof userRoles)[number];

export type Profile = {
  id: string;
  email: string;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
  mainRegion: string;
  detailedRegion: string | null;
  customRegion: string | null;
  interestCategories: string[];
  interestedCategories: string[];
  interestedRegions: string[];
  roles: UserRole[];
  accountStatus: "active" | "suspended";
  communityHostRevokedAt: string | null;
  communityHostRevocationReason: string | null;
  createdAt: string;
  updatedAt: string;
};
