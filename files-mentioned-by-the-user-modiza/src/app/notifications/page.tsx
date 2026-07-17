"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationItem } from "@/types/notification";

const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (offset = 0) => {
    const response = await fetch(`/api/notifications?offset=${offset}&limit=20`, { cache: "no-store" });
    if (response.status === 401) return router.replace("/login?next=%2Fnotifications");
    if (!response.ok) return;
    const data = await response.json();
    setItems((current) => offset ? [...current, ...data.items] : data.items);
    setUnread(data.unread); setHasMore(data.hasMore); setLoading(false);
  }, [router]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function open(item: NotificationItem) {
    if (!item.isRead) await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
    if (item.link) router.push(item.link); else void load();
  }
  async function readAll() { await fetch("/api/notifications", { method: "PATCH" }); setUnread(0); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); }

  return <section className="section"><div className="container notification-page"><div className="section-heading"><div><p className="eyebrow">Notifications</p><h1 className="section-title">알림</h1><p className="muted">읽지 않은 알림 {unread}개</p></div>{unread > 0 && <button className="btn btn-ghost" onClick={() => void readAll()}><CheckCheck />모두 읽음 처리</button>}</div>
    {loading ? <div className="empty">알림을 불러오는 중...</div> : items.length ? <div className="notification-page-list">{items.map((item) => <button type="button" className={`panel notification-page-item ${item.isRead ? "" : "unread"}`} key={item.id} onClick={() => void open(item)}><i /><div><h2>{item.title}</h2><p>{item.message}</p><small>{date(item.createdAt)}</small></div></button>)}</div> : <div className="empty"><Bell size={38} /><h2>새로운 알림이 없어요</h2><p>커뮤니티 신청 및 참가 결과와 관련된 소식을 이곳에서 확인할 수 있어요.</p></div>}
    {hasMore && <button className="btn btn-ghost notification-more" onClick={() => void load(items.length)}>더 보기</button>}
  </div></section>;
}
