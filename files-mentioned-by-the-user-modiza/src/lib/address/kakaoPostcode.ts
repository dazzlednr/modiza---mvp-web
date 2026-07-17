import { PRIMARY_REGION, subRegions, type SubRegion } from "@/constants/taxonomy";

export type KakaoPostcodeResult = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  sido: string;
  sigungu: string;
  bname: string;
};

export type StructuredSpaceAddress = {
  postalCode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  addressSido: string;
  addressSigungu: string;
  addressDong: string;
  mainRegion: typeof PRIMARY_REGION;
  detailedRegion: Exclude<SubRegion, "기타">;
};

const DAEGU_NAMES = new Set(["대구", "대구광역시"]);
const DAEGU_DISTRICTS = new Set(subRegions.filter((region) => region !== "기타"));

export function mapKakaoAddressToSpace(data: KakaoPostcodeResult): StructuredSpaceAddress | null {
  const district = data.sigungu.trim();
  const roadAddress = data.roadAddress.trim();
  if (!DAEGU_NAMES.has(data.sido.trim()) || !DAEGU_DISTRICTS.has(district as Exclude<SubRegion, "기타">) || !roadAddress) return null;
  return {
    postalCode: data.zonecode.trim(),
    roadAddress,
    jibunAddress: data.jibunAddress.trim(),
    buildingName: data.buildingName.trim(),
    addressSido: data.sido.trim(),
    addressSigungu: district,
    addressDong: data.bname.trim(),
    mainRegion: PRIMARY_REGION,
    detailedRegion: district as Exclude<SubRegion, "기타">,
  };
}
