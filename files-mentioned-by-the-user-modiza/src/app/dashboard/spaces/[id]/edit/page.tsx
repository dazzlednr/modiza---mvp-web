"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SpaceForm } from "@/components/space/SpaceForm";
import { MapViewButton } from "@/components/common/MapViewButton";
import type { Space } from "@/types/space";

export default function SpaceEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/spaces/${id}`).then(async (response) => {
      if (response.status === 404) return router.replace("/dashboard/spaces");
      if (!response.ok) throw new Error();
      setSpace(await response.json());
    }).catch(() => setError("공간 정보를 불러오지 못했어요."));
  }, [id, router]);

  if (error) return <section className="section"><div className="container empty">{error}</div></section>;
  if (!space) return <section className="section"><div className="container">공간 정보를 불러오는 중...</div></section>;
  const address = [space.address, space.addressDetail].filter(Boolean).join(" ");

  return <section className="section"><div className="container" style={{ maxWidth: 1000 }}>
    <div className="section-heading page-heading"><div><p className="eyebrow">Edit space</p><h1 className="section-title">공간 수정</h1></div>
      <MapViewButton address={address} placeName={space.name} />
    </div>
    <SpaceForm space={space} />
  </div></section>;
}
