import { useState, useEffect, useCallback, useMemo } from "react";
import "./analytics.css";

type AnalyticsNetwork = "facebook" | "instagram" | "x" | "linkedin" | "youtube" | "tiktok" | "generic";
type Period = "lifetime" | "month" | "week" | "day";

interface AnalyticsSnapshot {
  id: string;
  scheduleEntryId: string;
  network: AnalyticsNetwork;
  period: string;
  impressions: number | null;
  reach: number | null;
  engagements: number | null;
  clicks: number | null;
  shares: number | null;
  comments: number | null;
  likes: number | null;
  viewCount: number | null;
  fetchedAt: string;
  createdAt: string;
}

interface AnalyticsSummary {
  tenantId: string;
  network: AnalyticsNetwork | null;
  totalImpressions: number;
  totalReach: number;
  totalEngagements: number;
  totalClicks: number;
  totalShares: number;
  totalComments: number;
  totalLikes: number;
  avgEngagementRate: number;
  topPostId: string | null;
  snapshotCount: number;
}

const NETWORKS: Array<{ id: AnalyticsNetwork | "all"; label: string; dot: string }> = [
  { id: "all",       label: "All",       dot: "#7c3aed" },
  { id: "facebook",  label: "Facebook",  dot: "#1877f2" },
  { id: "instagram", label: "Instagram", dot: "#e1306c" },
  { id: "x",         label: "X",         dot: "#000" },
  { id: "linkedin",  label: "LinkedIn",  dot: "#0a66c2" },
  { id: "youtube",   label: "YouTube",   dot: "#ff0000" },
  { id: "tiktok",    label: "TikTok",    dot: "#111" },
];

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "lifetime", label: "All time" },
  { id: "month",    label: "Month" },
  { id: "week",     label: "Week" },
  { id: "day",      label: "Today" },
];

const apiOrigin = import.meta.env.VITE_ANALYTICS_API_ORIGIN ?? "http://localhost:8802";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function engRate(s: AnalyticsSnapshot): number {
  const eng = (s.engagements ?? 0) + (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0);
  const base = s.reach ?? s.impressions ?? 0;
  if (!base) return 0;
  return Math.min(100, (eng / base) * 100);
}

// SVG mini sparkline from a series of numbers
function Sparkline({ values, color = "#7c3aed" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 26;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h * 0.85 - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  // Filled area
  const area = `${pts[0].split(",")[0]},${h} ` + polyline + ` ${pts[pts.length - 1].split(",")[0]},${h}`;
  return (
    <div className="ad-stat-sparkline">
      <svg viewBox={`0 0 ${w} ${h}`} className="ad-sparkline-svg" preserveAspectRatio="none">
        <polygon points={area} fill={color} opacity="0.12" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <>
      <div className="ad-skeleton-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="ad-skeleton-card">
            <div className="ad-skeleton-line ad-skeleton-val" />
            <div className="ad-skeleton-line ad-skeleton-lbl" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ad-skeleton-item ad-skeleton-line" />
      ))}
    </>
  );
}

function exportCsv(snapshots: AnalyticsSnapshot[]) {
  const cols = ["id","scheduleEntryId","network","period","impressions","reach","engagements",
    "clicks","shares","comments","likes","viewCount","fetchedAt"];
  const rows = snapshots.map(s =>
    cols.map(c => JSON.stringify((s as Record<string, unknown>)[c] ?? "")).join(",")
  );
  const csv = [cols.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  tenantId: string;
}

export default function AnalyticsDashboard({ tenantId }: Props) {
  const [network, setNetwork]     = useState<AnalyticsNetwork | "all">("all");
  const [period]                  = useState<Period>("lifetime");
  const [activePeriod, setPeriod] = useState<Period>("lifetime");
  void period;
  const [summary, setSummary]     = useState<AnalyticsSummary | null>(null);
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const headers = useMemo(
    () => ({ "X-Tenant-Id": tenantId }),
    [tenantId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const netQ  = network !== "all" ? `&network=${network}` : "";
      const [sumRes, listRes] = await Promise.all([
        fetch(`${apiOrigin}/analytics/summary?period=${activePeriod}${netQ}`, { headers }),
        fetch(`${apiOrigin}/analytics?limit=50${netQ}`, { headers }),
      ]);
      if (sumRes.ok)  setSummary((await sumRes.json() as { summary: AnalyticsSummary }).summary);
      if (listRes.ok) setSnapshots((await listRes.json() as { snapshots: AnalyticsSnapshot[] }).snapshots);
    } finally {
      setLoading(false);
    }
  }, [tenantId, network, activePeriod, headers]);

  useEffect(() => { load(); }, [load]);

  async function refresh(scheduleEntryId: string) {
    setRefreshingId(scheduleEntryId);
    try {
      await fetch(`${apiOrigin}/analytics/refresh/${scheduleEntryId}`, { method: "POST", headers });
      await load();
    } finally {
      setRefreshingId(null);
    }
  }

  // Build sparkline series for impressions across snapshots (most-recent 8)
  const sparkValues = snapshots.slice(0, 8).map(s => s.impressions ?? 0).reverse();
  const topPost = summary?.topPostId
    ? snapshots.find(s => s.scheduleEntryId === summary.topPostId) ?? null
    : snapshots.length ? snapshots[0] : null;

  const statCards = summary
    ? [
        { label: "Impressions",  value: fmt(summary.totalImpressions),  hi: true,  sparkline: true },
        { label: "Reach",        value: fmt(summary.totalReach),         hi: false, sparkline: false },
        { label: "Engagements",  value: fmt(summary.totalEngagements),   hi: false, sparkline: false },
        { label: "Clicks",       value: fmt(summary.totalClicks),        hi: false, sparkline: false },
        { label: "Shares",       value: fmt(summary.totalShares),        hi: false, sparkline: false },
        { label: "Likes",        value: fmt(summary.totalLikes),         hi: false, sparkline: false },
        { label: "Comments",     value: fmt(summary.totalComments),      hi: false, sparkline: false },
        { label: "Eng Rate",     value: `${summary.avgEngagementRate.toFixed(2)}%`, hi: false, sparkline: false },
        { label: "Posts tracked",value: String(summary.snapshotCount),   hi: false, sparkline: false },
      ]
    : [];

  return (
    <div className="ad-root">
      {/* Header */}
      <div className="ad-header">
        <h2 className="ad-title">
          <span className="ad-title-dot" />
          Analytics
        </h2>
        <div className="ad-header-actions">
          {/* Period selector */}
          <div className="ad-period-tabs">
            {PERIODS.map(p => (
              <button
                key={p.id}
                className={`ad-period-tab${activePeriod === p.id ? " ad-period-tab--active" : ""}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            className="ad-export-btn"
            onClick={() => exportCsv(snapshots)}
            disabled={snapshots.length === 0}
          >
            ↓ CSV
          </button>
          <button className="ad-reload-btn" onClick={load} disabled={loading}>
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {loading && <SkeletonDashboard />}

      {!loading && (
        <>
          {/* Summary grid */}
          {statCards.length > 0 && (
            <div className="ad-summary-grid">
              {statCards.map(({ label, value, hi, sparkline }) => (
                <div key={label} className={`ad-stat-card${hi ? " ad-stat-card--highlight" : ""}`}>
                  <div className="ad-stat-row">
                    <span className="ad-stat-value">{value}</span>
                  </div>
                  <span className="ad-stat-label">{label}</span>
                  {sparkline && sparkValues.length >= 2 && (
                    <Sparkline values={sparkValues} color="var(--brand-primary, #7c3aed)" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Top post banner */}
          {topPost && (
            <div className="ad-top-banner">
              <span className="ad-top-banner-crown">🏆</span>
              <div className="ad-top-banner-body">
                <div className="ad-top-banner-label">Top performing post</div>
                <div className="ad-top-banner-id">{topPost.scheduleEntryId}</div>
              </div>
              <span className={`ad-network-badge ad-badge-${topPost.network}`}>{topPost.network}</span>
              <span className="ad-top-banner-eng">{fmt(topPost.engagements ?? topPost.likes)} eng</span>
            </div>
          )}

          {/* Network filter */}
          <div className="ad-filter-row">
            <span className="ad-filter-label">Network</span>
            {NETWORKS.map(n => (
              <button
                key={n.id}
                className={`ad-filter-btn${network === n.id ? " ad-filter-btn--active" : ""}`}
                onClick={() => setNetwork(n.id)}
              >
                <span className="ad-filter-dot" style={{ background: n.dot }} />
                {n.label}
              </button>
            ))}
          </div>

          {snapshots.length > 0 && (
            <div className="ad-section-header">
              <span className="ad-section-title">Snapshots</span>
              <span className="ad-section-count">{snapshots.length} posts</span>
            </div>
          )}

          {/* Snapshot list */}
          {snapshots.length === 0 ? (
            <div className="ad-empty">
              <div className="ad-empty-icon">📊</div>
              <p className="ad-empty-text">
                No snapshots yet. Publish content and tap Refresh on a post to pull live metrics.
              </p>
            </div>
          ) : (
            <div className="ad-list">
              {snapshots.map(s => {
                const er = engRate(s);
                return (
                  <div key={s.id} className="ad-item">
                    <div className="ad-item-header">
                      <span className="ad-item-entry" title={s.scheduleEntryId}>
                        {s.scheduleEntryId}
                      </span>
                      <span className={`ad-network-badge ad-badge-${s.network}`}>{s.network}</span>
                      <span className="ad-item-meta">{relTime(s.fetchedAt)}</span>
                      <button
                        className="ad-refresh-btn"
                        onClick={() => refresh(s.scheduleEntryId)}
                        disabled={refreshingId === s.scheduleEntryId}
                      >
                        {refreshingId === s.scheduleEntryId ? "…" : "↻ Refresh"}
                      </button>
                    </div>

                    {/* Engagement bar */}
                    <div className="ad-eng-bar-wrap">
                      <div className="ad-eng-bar-track">
                        <div
                          className="ad-eng-bar-fill"
                          style={{ width: `${Math.min(er, 100)}%` }}
                        />
                      </div>
                      <span className="ad-eng-pct">{er.toFixed(1)}% eng</span>
                    </div>

                    <div className="ad-metrics-row">
                      {([
                        ["Imp",      s.impressions],
                        ["Reach",    s.reach],
                        ["Eng",      s.engagements],
                        ["Clicks",   s.clicks],
                        ["Shares",   s.shares],
                        ["Likes",    s.likes],
                        ["Comments", s.comments],
                        ["Views",    s.viewCount],
                      ] as [string, number | null][])
                        .filter(([, v]) => v !== null)
                        .map(([k, v]) => (
                          <div key={k} className="ad-metric">
                            <span className="ad-metric-val">{fmt(v)}</span>
                            <span className="ad-metric-key">{k}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
