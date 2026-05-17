"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, FileStack, FileText, Gauge, KeyRound, LayoutDashboard, ListChecks, MailCheck, MessageSquareText, ShieldCheck, Settings2, SlidersHorizontal } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/preferences", label: "Preferences", icon: Settings2 },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/tracker", label: "Tracker", icon: ListChecks },
  { href: "/automation", label: "Automation", icon: ShieldCheck },
  { href: "/sources", label: "Sources", icon: SlidersHorizontal },
  { href: "/approval-queue", label: "Approvals", icon: MailCheck },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/resume-versions", label: "Versions", icon: FileStack },
  { href: "/follow-ups", label: "Follow-ups", icon: MailCheck },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/audit-logs", label: "Audit", icon: ClipboardList },
  { href: "/answer-templates", label: "Answers", icon: MessageSquareText },
  { href: "/settings/extension", label: "Extension", icon: KeyRound },
  { href: "/settings/automation", label: "Auto Settings", icon: Settings2 },
  { href: "/settings/email", label: "Email Settings", icon: MailCheck }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex max-h-screen min-h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5">
      <Link href="/dashboard" className="mb-7 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-white">
          <Gauge size={22} />
        </span>
        <span>
          <span className="block text-sm font-bold text-ink">Job Copilot</span>
          <span className="block text-xs text-slate-500">Assisted Apply</span>
        </span>
      </Link>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-ink"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        Phase 3 blocks restricted auto-apply and logs every automated action.
      </div>
    </aside>
  );
}
