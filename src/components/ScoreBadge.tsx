export function ScoreBadge({ score }: { score?: number | null }) {
  const value = score ?? 0;
  const tone = value >= 80 ? "bg-emerald-100 text-emerald-800" : value >= 60 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
  return <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${tone}`}>{value}/100</span>;
}
