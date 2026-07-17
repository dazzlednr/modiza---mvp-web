"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicSpaceDetail } from "@/types/public-space";

export function SpacePhotoGallery({ space }: { space: PublicSpaceDetail }) {
  const photos = useMemo(() => {
    const sorted = [...space.images].sort((a, b) => a.sortOrder - b.sortOrder);
    if (sorted.length) return sorted.map((image) => image.publicUrl);
    return space.thumbnailUrl ? [space.thumbnailUrl] : [];
  }, [space.images, space.thumbnailUrl]);
  const [active, setActive] = useState(0);

  if (!photos.length) {
    return <div className="space-detail-photo space-detail-photo-empty"><ImageIcon aria-hidden="true" /><span>등록된 장소 사진이 없어요.</span></div>;
  }

  const move = (offset: number) => setActive((current) => (current + offset + photos.length) % photos.length);

  return <div className="space-detail-gallery">
    <div className="space-detail-photo">
      <Image src={photos[active]} alt={`${space.name} 사진 ${active + 1}`} fill sizes="(max-width: 760px) 100vw, 960px" priority />
      {photos.length > 1 && <>
        <button type="button" className="gallery-arrow gallery-arrow-left" aria-label="이전 사진" onClick={() => move(-1)}><ChevronLeft /></button>
        <button type="button" className="gallery-arrow gallery-arrow-right" aria-label="다음 사진" onClick={() => move(1)}><ChevronRight /></button>
        <span className="space-detail-photo-count">{active + 1} / {photos.length}</span>
      </>}
    </div>
    {photos.length > 1 && <div className="space-detail-thumbnails" aria-label="공간 사진 선택">
      {photos.map((photo, index) => <button type="button" className={index === active ? "active" : ""} aria-label={`${index + 1}번째 사진 보기`} aria-current={index === active} key={`${photo}-${index}`} onClick={() => setActive(index)}>
        <Image src={photo} alt="" fill sizes="76px" />
      </button>)}
    </div>}
  </div>;
}
