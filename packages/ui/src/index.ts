export type BadgeTone = "neutral" | "success" | "warning";

export function badgeClasses(tone: BadgeTone): string {
  const toneClassMap: Record<BadgeTone, string> = {
    neutral: "bg-slate-100 text-slate-800",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-900",
  };

  return `inline-flex rounded px-2 py-1 text-xs font-medium ${toneClassMap[tone]}`;
}
