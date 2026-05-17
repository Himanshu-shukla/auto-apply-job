const tone: Record<string, string> = {
  restricted_platform: "bg-rose-50 text-rose-800 border-rose-200",
  unknown: "bg-slate-50 text-slate-700 border-slate-200",
  direct_email: "bg-cyan-50 text-cyan-800 border-cyan-200",
  company_career_page: "bg-emerald-50 text-emerald-800 border-emerald-200",
  official_api: "bg-indigo-50 text-indigo-800 border-indigo-200",
  partner_feed: "bg-sky-50 text-sky-800 border-sky-200",
  user_imported: "bg-amber-50 text-amber-800 border-amber-200",
  pending_review: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  sent: "bg-teal-50 text-teal-800 border-teal-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200"
};

export function PolicyBadge({ value }: { value?: string | null }) {
  return <Badge value={value ?? "unknown"} />;
}

export function AutomationBadge({ value }: { value?: string | null }) {
  return <Badge value={value ?? "save_only"} />;
}

export function ApprovalBadge({ value }: { value?: string | null }) {
  return <Badge value={value ?? "pending_review"} />;
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone[value] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
