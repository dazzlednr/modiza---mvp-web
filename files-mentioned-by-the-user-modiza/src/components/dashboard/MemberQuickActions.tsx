"use client";

import Link from "next/link";
import { Bell, ClipboardCheck, Clock3, Compass, Heart, Settings2, X } from "lucide-react";
import { useState } from "react";
import { MemberTasteSettings } from "@/components/dashboard/MemberTasteSettings";

type Activity = {
  id: string;
  label: string;
  date: string;
  href: string | null;
  icon: "application" | "cancelled" | "favorite";
};

type NewsItem = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
};

type MemberQuickActionsProps = {
  activities: Activity[];
  notifications: NewsItem[];
  initialCategories: string[];
  initialRegions: string[];
};

type DialogName = "activities" | "taste" | "news" | null;

const koDate = (value: Date | string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(value));

export function MemberQuickActions({ activities, notifications, initialCategories, initialRegions }: MemberQuickActionsProps) {
  const [openDialog, setOpenDialog] = useState<DialogName>(null);
  const dialogTitle = openDialog === "activities" ? "최근 활동" : openDialog === "taste" ? "내 취향 설정" : "모임 소식";

  return <>
    <section className="panel member-sidebar-panel member-quick-actions">
      <div className="section-heading"><div><p className="eyebrow">Quick action</p><h2>빠른 실행</h2></div><Compass /></div>
      <nav className="member-quick-action-list" aria-label="빠른 실행 메뉴">
        <Link href="/communities"><Compass /><span>모임 둘러보기</span></Link>
        <button type="button" onClick={() => setOpenDialog("activities")}><Clock3 /><span>최근 활동</span></button>
        <button type="button" onClick={() => setOpenDialog("taste")}><Settings2 /><span>내 취향 설정</span></button>
        <button type="button" onClick={() => setOpenDialog("news")}><Bell /><span>모임 소식</span></button>
      </nav>
    </section>

    {openDialog && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setOpenDialog(null)}>
      <section className="dialog member-action-dialog" role="dialog" aria-modal="true" aria-labelledby="member-action-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="member-action-dialog-header"><div><p className="eyebrow">My activity</p><h2 id="member-action-dialog-title">{dialogTitle}</h2></div><button type="button" aria-label={`${dialogTitle} 닫기`} onClick={() => setOpenDialog(null)}><X /></button></div>

        {openDialog === "activities" && (activities.length ? <div className="member-activity-feed member-action-feed">{activities.map((activity) => {
          const icon = activity.icon === "favorite" ? <Heart /> : activity.icon === "cancelled" ? <X /> : <ClipboardCheck />;
          const content = <><i>{icon}</i><span><b>{activity.label}</b><small>{koDate(activity.date)}</small></span></>;
          return activity.href ? <Link href={activity.href} key={activity.id} onClick={() => setOpenDialog(null)}>{content}</Link> : <div key={activity.id}>{content}</div>;
        })}</div> : <div className="member-sidebar-empty"><Clock3 /><p>아직 직접 수행한 활동이 없어요.</p></div>)}

        {openDialog === "taste" && <MemberTasteSettings variant="editor" initialCategories={initialCategories} initialRegions={initialRegions} onSaved={() => setOpenDialog(null)} onCancel={() => setOpenDialog(null)} />}

        {openDialog === "news" && (notifications.length ? <div className="member-news-feed member-action-feed">{notifications.map((item) => {
          const content = <><b>{item.title}</b><p>{item.message}</p><small>{koDate(item.createdAt)}</small></>;
          return item.link ? <Link href={item.link} key={item.id} onClick={() => setOpenDialog(null)}>{content}</Link> : <article key={item.id}>{content}</article>;
        })}</div> : <div className="member-sidebar-empty"><Bell /><p>확인할 모임 소식이 없어요.</p></div>)}
      </section>
    </div>}
  </>;
}
