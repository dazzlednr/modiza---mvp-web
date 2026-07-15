import { userRoles, type Profile, type UserRole } from "@/types/profile";

const roleSet = new Set<string>(userRoles);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && roleSet.has(value);
}

export function normalizeRoles(roles: unknown): UserRole[] {
  const source = Array.isArray(roles) ? roles.filter(isUserRole) : [];
  const unique = new Set<UserRole>(["member", ...source]);
  return userRoles.filter((role) => unique.has(role));
}

export function addRole(
  currentRoles: unknown,
  newRole: UserRole,
): UserRole[] {
  return normalizeRoles([...normalizeRoles(currentRoles), newRole]);
}

export function hasRole(
  profile: Pick<Profile, "roles"> | null | undefined,
  role: UserRole,
) {
  return Boolean(profile && normalizeRoles(profile.roles).includes(role));
}

export function hasAnyRole(
  profile: Pick<Profile, "roles"> | null | undefined,
  roles: UserRole[],
) {
  return roles.some((role) => hasRole(profile, role));
}

export function getRoleLabel(role: UserRole) {
  return {
    member: "일반 회원",
    community_host: "커뮤니티 운영자",
    space_host: "공간 운영자",
    admin: "관리자",
  }[role];
}

export const selfActivatableRoles = [
  "community_host",
  "space_host",
] as const satisfies readonly UserRole[];

export type SelfActivatableRole = (typeof selfActivatableRoles)[number];

export function isSelfActivatableRole(
  value: unknown,
): value is SelfActivatableRole {
  return selfActivatableRoles.some((role) => role === value);
}
