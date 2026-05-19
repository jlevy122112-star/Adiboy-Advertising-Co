import { useState, useCallback, useEffect } from "react";
import "./predictive.css";
import { apiFetch } from "../hooks/useApi";

type ConfidenceLevel = "low" | "medium" | "high";

interface BestTimeSlot {
  dayOfWeek: number;
  hourUTC: number;
  score: number;
  engagementScore: number;
  reachScore: number;
  confidence: ConfidenceLevel;
  reasons: string[];
}

interface ScheduleRecommendation {
  id: string;
  network: string;
  contentType: string | null;
  audienceTimezone: string | null;
  topSlots: BestTimeSlot[];
  appliedSlot: BestTimeSlot | null;
  appliedAt: string | null;
  createdAt: string;
}

const NETWORKS = ["facebook","instagram","x","linkedin","youtube","tiktok"];
const CONTENT_TYPES = ["image","video","text","link"];
const TIMEZONES = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "Europe/London","Europe/Paris","Asia/Tokyo","Asia/Singapore","Australia/Sydney",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const apiOrigin = import.meta.env.VITE_PREDICTIVE_API_ORIGIN ?? "http://localhost:8804";

function formatSlotTime(slot: BestTimeSlot, tz?: string): string {
  // Show UTC time, local conversion is approximate
  const days  = DAY_LABELS[slot.dayOfWeek] ?? "?";
  const h     = slot.hourUTC;
  const ampm  = h >= 12 ? "pm" : "am";
  const h12   = h % 12 || 12;
  const label = tz ? `${h12}${ampm} UTC` : `${h12}${ampm} UTC`;
  return `${days} ${label}`;
}

function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Score → heat colour (purple gradient)
function scoreToColor(score: number): string {
  if (score <= 0) return "rgba(0,0,0,0.04)";
  const alpha = 0.08 + (score / 100) * 0.82;
  return `rgba(124,58,237,${alpha.toFixed(2)})`;
}

interface HeatmapProps {
  slots: BestTimeSlot[];
  topSlotKeys: Set<string>;
}

function Heatmap({ slots, topSlotKeys }: HeatmapProps) {
  const scoreMap = new Map(slots.map(s => [`${s.dayOfWeek}:${s.hourUTC}`, s.score]));
  const HOURS_SHOWN = [0, 3, 6, 9, 12, 15, 18, 21]; // every 3h

  return (
    <div className="ps-heatmap-wrap">
      <div className="ps-heatmap-title">Engagement heatmap (UTC)</div>
      <div className="ps-heatmap">
        {/* Header row: empty + day labels */}
        <div />
        {DAY_LABELS.map(d => <div key={d} className="ps-heatmap-day-label">{d}</div>)}

        {/* Hour rows */}
        {HOURS_SHOWN.map(h => (
          <>
            <div key={`lbl-${h}`} className="ps-heatmap-hour-label">
              {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
            </div>
            {DAY_LABELS.map((_, dow) => {
              const key   = `${dow}:${h}`;
              const score = scoreMap.get(key) ?? 0;
              const isTop = topSlotKeys.has(key);
              return (
                <div
                  key={key}
                  className={`ps-heatmap-cell${isTop ? " ps-heatmap-cell--top" : ""}`}
                  style={{ background: scoreToColor(score) }}
                  title={score > 0 ? `${DAY_LABELS[dow]} ${h}:00 UTC — Score ${score}` : undefined}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

export function PredictiveSchedulePanel() {
  const [network,     setNetwork]     = useState("instagram");
  const [contentType, setContentType] = useState("");
  const [timezone,    setTimezone]    = useState("America/New_York");
  const [loading,     setLoading]     = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [rec,         setRec]         = useState<ScheduleRecommendation | null>(null);
  const [history,     setHistory]     = useState<ScheduleRecommendation[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [applying,    setApplying]    = useState(false);
  const [applied,     setApplied]     = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await apiFetch<{ recommendations: ScheduleRecommendation[] }>(`${apiOrigin}/schedule/history?limit=5`);
    if (res.ok) setHistory(res.data.recommendations);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function predict() {
    setLoading(true);
    setRec(null);
    setSelectedKey(null);
    setApplied(null);
    setPredictError(null);
    const res = await apiFetch<{ recommendation: ScheduleRecommendation }>(`${apiOrigin}/schedule/predict`, {
      method: "POST",
      json: {
        network,
        contentType: contentType || undefined,
        audienceTimezone: timezone || undefined,
      },
    });
    if (res.ok) {
      setRec(res.data.recommendation);
      await loadHistory();
    } else {
      setPredictError("Prediction failed. Please try again.");
    }
    setLoading(false);
  }

  async function applySlot(slot: BestTimeSlot) {
    if (!rec?.id) return;
    setApplying(true);
    const res = await apiFetch(`${apiOrigin}/schedule/apply/${rec.id}`, {
      method: "POST",
      json: { slot },
    });
    if (res.ok) {
      setApplied(`${slot.dayOfWeek}:${slot.hourUTC}`);
      await loadHistory();
    }
    setApplying(false);
  }

  const topSlotKeys = new Set((rec?.topSlots ?? []).map(s => `${s.dayOfWeek}:${s.hourUTC}`));
  const allSlots    = rec?.topSlots ?? [];

  return (
    <div className="ps-root">
      {/* Header */}
      <div className="ps-header">
        <h2 className="ps-title">🗓 Best Time to Post</h2>
      </div>

      {/* Controls */}
      <div className="ps-controls">
        <div className="ps-control-row">
          <span className="ps-control-label">Network</span>
          <select className="ps-select" value={network} onChange={e => setNetwork(e.target.value)}>
            {NETWORKS.map(n => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
          </select>
        </div>
        <div className="ps-control-row">
          <span className="ps-control-label">Content</span>
          <select className="ps-select" value={contentType} onChange={e => setContentType(e.target.value)}>
            <option value="">Any type</option>
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className="ps-control-row">
          <span className="ps-control-label">Audience</span>
          <select className="ps-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
          </select>
        </div>
        <button className="ps-predict-btn" onClick={predict} disabled={loading}>
          {loading ? "Analyzing…" : "✦ Predict Best Times"}
        </button>
      </div>

      {/* Heatmap */}
      {allSlots.length > 0 && (
        <Heatmap slots={allSlots} topSlotKeys={topSlotKeys} />
      )}

      {/* Ranked slots */}
      {allSlots.length > 0 && (
        <>
          <div className="ps-slots-title">Top recommended slots</div>
          <div className="ps-slot-list">
            {allSlots.map((slot, i) => {
              const key     = `${slot.dayOfWeek}:${slot.hourUTC}`;
              const isApplied = applied === key;
              return (
                <div
                  key={key}
                  className={[
                    "ps-slot",
                    `ps-slot--rank${Math.min(i + 1, 3)}`,
                    selectedKey === key ? "ps-slot--selected" : "",
                  ].join(" ")}
                  onClick={() => setSelectedKey(selectedKey === key ? null : key)}
                >
                  <div className="ps-slot-header">
                    <span className="ps-slot-time">{formatSlotTime(slot, timezone)}</span>
                    <span className={`ps-confidence ps-confidence--${slot.confidence}`}>
                      {slot.confidence}
                    </span>
                    <span className="ps-slot-score">{slot.score}/100</span>
                  </div>

                  <div className="ps-score-bar-track">
                    <div className="ps-score-bar-fill" style={{ width: `${slot.score}%` }} />
                  </div>

                  {selectedKey === key && (
                    <>
                      <div className="ps-slot-reasons">
                        {slot.reasons.map((r, ri) => (
                          <div key={ri} className="ps-slot-reason">
                            <span className="ps-reason-dot" />
                            {r}
                          </div>
                        ))}
                      </div>
                      <button
                        className={`ps-apply-btn${isApplied ? " ps-apply-btn--applied" : ""}`}
                        onClick={e => { e.stopPropagation(); applySlot(slot); }}
                        disabled={applying || isApplied}
                      >
                        {isApplied ? "✓ Applied" : applying ? "Applying…" : "Apply this slot"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {predictError && (
        <div className="ps-error-row">
          <p className="ps-error">{predictError}</p>
          <button className="ps-predict-btn" onClick={predict}>Retry</button>
        </div>
      )}

      {!loading && !rec && !predictError && (
        <div className="ps-empty">
          <div className="ps-empty-icon">⏰</div>
          <p className="ps-empty-text">
            Select a network and click Predict to get AI-powered post timing recommendations.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <div className="ps-divider" />
          <div className="ps-history-section">
            <div className="ps-history-title">Recent predictions</div>
            {history.map(h => {
              const top = h.topSlots[0];
              return (
                <div key={h.id} className="ps-history-item" onClick={() => setRec(h)}>
                  <span className="ps-history-net">{h.network}</span>
                  <span className="ps-history-time">
                    {top ? formatSlotTime(top) : "—"}
                    {top ? ` (${top.score}/100)` : ""}
                  </span>
                  {h.appliedAt && <span style={{ fontSize: "0.58rem", color: "#059669" }}>✓</span>}
                  <span className="ps-history-meta">{relTime(h.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
