"use client";
import { PRIMARY_REGION, subRegions } from "@/constants/taxonomy";

export function RegionFields({ mainRegion, detailedRegion, customRegion, onChange, disabled = false }: { mainRegion: string; detailedRegion: string; customRegion?: string | null; onChange: (value: { mainRegion: string; detailedRegion: string; customRegion: string }) => void; disabled?: boolean }) {
  return <div className="grid form-grid region-fields">
    <label>대표 지역<select className="field" disabled={disabled} value={mainRegion || PRIMARY_REGION} onChange={() => onChange({ mainRegion: PRIMARY_REGION, detailedRegion, customRegion: customRegion ?? "" })}><option value={PRIMARY_REGION}>{PRIMARY_REGION}</option></select></label>
    <label>세부 지역<select className="field" disabled={disabled} value={detailedRegion} onChange={(event) => onChange({ mainRegion: PRIMARY_REGION, detailedRegion: event.target.value, customRegion: "" })}><option value="">선택</option>{subRegions.map((region) => <option key={region}>{region}</option>)}</select></label>
    {detailedRegion === "기타" && <label className="custom-region-field">기타 지역명<input className="field" disabled={disabled} required value={customRegion ?? ""} maxLength={80} placeholder="지역명을 입력해 주세요" onChange={(event) => onChange({ mainRegion: PRIMARY_REGION, detailedRegion, customRegion: event.target.value })} /></label>}
  </div>;
}
