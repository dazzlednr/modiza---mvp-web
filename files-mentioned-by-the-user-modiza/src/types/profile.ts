export const userRoles = [
  "member",
  "community_host",
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
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
};
