import { PRIMARY_REGION, subRegions } from "@/constants/taxonomy";

export const representativeRegions = subRegions.filter((region) => region !== "기타");
export const spaceRegions = [PRIMARY_REGION] as const;
export const spaceRegionDetails = { [PRIMARY_REGION]: subRegions } as const;
export type RepresentativeRegion = (typeof representativeRegions)[number];
export type RegionFilter = RepresentativeRegion | "전체 보기";

export function matchesRegion(value: string, filter: string, custom = "") {
  if (!filter || filter === "전체 보기" || filter === "전체 지역" || filter === PRIMARY_REGION) return true;
  return `${value} ${custom}`.includes(filter);
}

export function getRepresentativeRegion(value: string): RepresentativeRegion | "기타" {
  return representativeRegions.find((region) => value.includes(region)) ?? "기타";
}
