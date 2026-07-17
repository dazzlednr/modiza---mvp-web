import { Navigation } from "lucide-react";
import { getNaverMapSearchUrl } from "@/lib/map/naver";

export function MapViewButton({
  address,
  placeName,
  label = "지도 보기",
  className = "btn btn-ghost",
}: {
  address?: string | null;
  placeName?: string | null;
  label?: string;
  className?: string;
}) {
  const href = getNaverMapSearchUrl(address, placeName);
  if (!href) return null;
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer"><Navigation size={17} /> {label}</a>;
}
