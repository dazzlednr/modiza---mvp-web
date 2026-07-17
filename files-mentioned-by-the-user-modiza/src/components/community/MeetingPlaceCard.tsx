"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Images, MapPin } from "lucide-react";
import type { Space } from "@/types/space";
import { MapViewButton } from "@/components/common/MapViewButton";

export function MeetingPlaceCard({ place }: { place: Space }) {
  const photos = useMemo(() => {
    const sorted = [...place.images].sort((a, b) => a.sortOrder - b.sortOrder);
    if (sorted.length > 0) return sorted.map((image) => image.publicUrl);
    return place.thumbnailUrl ? [place.thumbnailUrl] : [];
  }, [place.images, place.thumbnailUrl]);
  const [activePhoto, setActivePhoto] = useState(0);
  const address = [place.address, place.addressDetail].filter(Boolean).join(" ");
  const facilities = [...place.facilities];
  if (place.parkingAvailable && !facilities.includes("주차 가능")) facilities.push("주차 가능");
  const atmosphere = place.shortDescription?.trim()
    || (place.moods.length > 0 ? `${place.moods.slice(0, 3).join(", ")} 분위기의 장소입니다.` : "모임에 편안하게 참여할 수 있는 장소입니다.");

  function move(direction: number) {
    setActivePhoto((current) => (current + direction + photos.length) % photos.length);
  }

  return (
    <section className="meeting-place-card" aria-labelledby="meeting-place-title">
      <div className="meeting-place-heading">
        <div><p className="eyebrow">Meeting place</p><h2 id="meeting-place-title"><MapPin size={22} aria-hidden="true" /> 모임 장소</h2></div>
        {photos.length > 1 && <span className="meeting-place-count">{activePhoto + 1} / {photos.length}</span>}
      </div>
      {photos.length > 0 && (
        <div className="meeting-place-gallery" id="meeting-place-gallery">
          <div className="meeting-place-photo">
            <Image src={photos[activePhoto]} alt={`${place.name} 장소 사진 ${activePhoto + 1}`} fill sizes="(max-width: 720px) 100vw, 920px" />
            {photos.length > 1 && <>
              <button type="button" className="gallery-arrow gallery-arrow-left" aria-label="이전 장소 사진" onClick={() => move(-1)}><ChevronLeft /></button>
              <button type="button" className="gallery-arrow gallery-arrow-right" aria-label="다음 장소 사진" onClick={() => move(1)}><ChevronRight /></button>
            </>}
          </div>
          {photos.length > 1 && <div className="meeting-place-thumbnails" aria-label="장소 사진 선택">{photos.map((photo, index) => (
            <button type="button" key={`${photo}-${index}`} className={index === activePhoto ? "active" : ""} aria-label={`${index + 1}번째 장소 사진 보기`} aria-current={index === activePhoto} onClick={() => setActivePhoto(index)}><Image src={photo} alt="" fill sizes="72px" /></button>
          ))}</div>}
        </div>
      )}
      <div className="meeting-place-content">
        <h3>{place.name}</h3><p>{atmosphere}</p>
        {facilities.length > 0 && <div className="meeting-place-info"><strong>시설</strong><div className="meeting-place-tags">{facilities.map((facility) => <span key={facility}>{facility}</span>)}</div></div>}
        <div className="meeting-place-info"><strong>주소</strong><p>{address || "상세 위치는 참여 확정 후 안내됩니다."}</p></div>
        <div className="meeting-place-actions">
          {photos.length > 0 && <a className="btn btn-ghost" href="#meeting-place-gallery"><Images size={17} /> 사진 보기</a>}
          <MapViewButton address={address} placeName={place.name} />
        </div>
      </div>
    </section>
  );
}
