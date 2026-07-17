"use client";

import Script from "next/script";
import { MapPin, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { mapKakaoAddressToSpace, type KakaoPostcodeResult, type StructuredSpaceAddress } from "@/lib/address/kakaoPostcode";

declare global {
  interface Window {
    kakao?: {
      Postcode: new (options: {
        oncomplete: (data: KakaoPostcodeResult) => void;
        onclose?: () => void;
        width?: string;
        height?: string;
        maxSuggestItems?: number;
      }) => { embed: (element: HTMLElement) => void };
    };
  }
}

export function RoadAddressSearch({
  address,
  structured,
  onSelect,
}: {
  address: string;
  structured: boolean;
  onSelect: (address: StructuredSpaceAddress) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && Boolean(window.kakao?.Postcode));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function openSearch() {
    setError("");
    if (!ready || !window.kakao?.Postcode) {
      setError("주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setOpen(true);
    requestAnimationFrame(() => {
      if (!layerRef.current || !window.kakao?.Postcode) return;
      layerRef.current.replaceChildren();
      new window.kakao.Postcode({
        width: "100%",
        height: "100%",
        maxSuggestItems: 5,
        onclose: () => setOpen(false),
        oncomplete: (data) => {
          const mapped = mapKakaoAddressToSpace(data);
          if (!mapped) {
            setError(data.sido && !["대구", "대구광역시"].includes(data.sido)
              ? "현재는 대구 지역의 공간만 등록할 수 있어요."
              : "도로명 주소와 세부 지역을 확인할 수 없습니다. 다른 검색 결과를 선택해주세요.");
            return;
          }
          onSelect(mapped);
          setOpen(false);
          setError("");
        },
      }).embed(layerRef.current);
    });
  }

  return <div className="road-address-search">
    <Script
      id="kakao-postcode-script"
      src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      strategy="afterInteractive"
      onLoad={() => setReady(true)}
      onReady={() => setReady(true)}
      onError={() => {
        setReady(false);
        setError("주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }}
    />
    <div className="road-address-heading"><strong>도로명 주소</strong><button type="button" className="btn btn-ghost address-search-button" onClick={openSearch}><Search size={17} />주소 검색</button></div>
    <div className={`selected-road-address ${structured ? "selected" : "legacy"}`}>
      <MapPin size={18} aria-hidden="true" />
      <span>{address || "주소 검색 버튼을 눌러 도로명 주소를 선택해주세요."}</span>
      {address && <small>{structured ? "주소 검색으로 선택한 도로명 주소" : "기존에 저장된 주소 · 수정하려면 주소를 다시 검색해주세요."}</small>}
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {open && <div className="postcode-backdrop" role="dialog" aria-modal="true" aria-label="도로명 주소 검색">
      <div className="postcode-dialog">
        <div className="postcode-dialog-header"><strong>도로명 주소 검색</strong><button type="button" className="icon-button" aria-label="주소 검색 닫기" onClick={() => setOpen(false)}><X /></button></div>
        <div ref={layerRef} className="postcode-layer" />
      </div>
    </div>}
  </div>;
}
