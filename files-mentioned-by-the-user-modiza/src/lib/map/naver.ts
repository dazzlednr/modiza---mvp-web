export function getNaverMapSearchUrl(address?: string | null, placeName?: string | null) {
  const normalizedAddress = address?.trim();
  if (!normalizedAddress) return null;
  const query = [placeName?.trim(), normalizedAddress].filter(Boolean).join(" ");
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}
