export function safeInternalPath(value: string | null | undefined, fallback = "/mypage") {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export function loginPath(destination: string) {
  return `/login?next=${encodeURIComponent(safeInternalPath(destination))}`;
}

export function roleStartPath(
  destination: string,
  role?: "community_host" | "space_host",
) {
  const search = new URLSearchParams({
    redirect: safeInternalPath(destination),
  });
  if (role) search.set("role", role);
  return `/role/start?${search.toString()}`;
}
