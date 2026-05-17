"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/notifications");
    setNotifications((await response.json()).notifications ?? []);
  }

  async function read(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    await load();
  }

  return (
    <>
      <PageHeader title="Notifications" subtitle="High-match jobs, approvals, follow-ups, failed sends, and limits." />
      <div className="space-y-3">
        {notifications.length ? notifications.map((item) => (
          <article key={item.id} className={`panel p-4 ${item.readAt ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{item.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                {item.link ? <Link className="mt-2 inline-block text-sm font-semibold text-teal-700" href={item.link}>Open</Link> : null}
              </div>
              {!item.readAt ? <button className="btn-secondary" onClick={() => read(item.id)}><Check size={16} />Read</button> : null}
            </div>
          </article>
        )) : <div className="panel p-8 text-center text-sm text-slate-600">No notifications yet.</div>}
      </div>
    </>
  );
}
