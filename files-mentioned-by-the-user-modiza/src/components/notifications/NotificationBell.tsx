"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import type { NotificationItem } from "@/types/notification";

const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(ref, open, close);

  const load = useCallback(async () => {
    // account is only a client cache key. The API always derives the real
    // account from the authenticated Supabase session and ignores this value.
    const response = await fetch(`/api/notifications?limit=8&account=${encodeURIComponent(userId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setItems(data.items);
    setUnread(data.unread);
  }, [userId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  async function openItem(item: NotificationItem) {
    if (!item.isRead) {
      await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
      setUnread((value) => Math.max(0, value - 1));
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  async function readAll() {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (!response.ok) return;
    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  }

  return <div className="notification-bell-wrap" ref={ref}>
    <button type="button" className="notification-bell" aria-label={`알림${unread ? ` ${unread}개 읽지 않음` : ""}`} aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next) void load(); }}>
      <Bell aria-hidden="true" />{unread > 0 && <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section className="notification-popover">
      <div className="notification-popover-head"><div><strong>알림</strong><small>읽지 않음 {unread}개</small></div>{unread > 0 && <button type="button" onClick={() => void readAll()}><CheckCheck />모두 읽음</button>}</div>
      <div className="notification-list">
        {items.length ? items.map((item) => <button type="button" className={`notification-item ${item.isRead ? "" : "unread"}`} key={item.id} onClick={() => void openItem(item)}><i /><span><b>{item.title}</b><em>{item.message}</em><small>{date(item.createdAt)}</small></span></button>) : <div className="notification-empty"><Bell /><b>새로운 알림이 없어요</b><p>커뮤니티 신청 및 참가 결과와 관련된 소식을 이곳에서 확인할 수 있어요.</p></div>}
      </div>
      <Link className="notification-all-link" href="/notifications" onClick={() => setOpen(false)}>알림 전체 보기 →</Link>
    </section>}
  </div>;
}
