import { useState, useEffect, useCallback } from "react";
import "./sentiment.css";
import { apiFetch } from "../hooks/useApi";

type SentimentScore = "positive" | "negative" | "neutral" | "mixed";
type BrandSafetyFlag =
  | "hate_speech" | "misinformation" | "spam" | "competitor_attack"
  | "pii_exposure" | "inappropriate_content" | "legal_risk";

interface SocialComment {
  id: string;
  scheduleEntryId: string;
  network: string;
  externalCommentId: string;
  authorName?: string;
  body: string;
  likeCount: number | null;
  replyCount: number | null;
  postedAt: string | null;
  sentimentScore: SentimentScore | null;
  sentimentConfidence: number | null;
  topics: string[];
  isNegativeSignal: boolean;
  brandSafetyFlags: BrandSafetyFlag[];
  suggestedResponse: string | null;
  fedToMemory: boolean;
  createdAt: string;
}

interface SentimentSummary {
  totalComments: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  mixedCount: number;
  negativeSignalCount: number;
  brandSafetyFlagCount: number;
  avgConfidence: number;
  topTopics: Array<{ topic: string; count: number }>;
  overallSentiment: SentimentScore | null;
}

type Filter = "all" | "positive" | "negative" | "neutral" | "mixed" | "flagged" | "signals";

const FLAG_LABELS: Record<BrandSafetyFlag, string> = {
  hate_speech: "Hate",
  misinformation: "Misinfo",
  spam: "Spam",
  competitor_attack: "Attack",
  pii_exposure: "PII",
  inappropriate_content: "NSFW",
  legal_risk: "Legal",
};

const apiOrigin = import.meta.env.VITE_SENTIMENT_API_ORIGIN ?? "http://localhost:8803";

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function pct(count: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function SentimentBadge({ score }: { score: SentimentScore | null }) {
  if (!score) return null;
  const emoji = { positive: "😊", negative: "😠", neutral: "😐", mixed: "🤔" }[score];
  return <span className={`sp-sentiment-badge sp-badge-${score}`}>{emoji} {score}</span>;
}

interface Props {
  tenantId: string;
}

export function SentimentPanel({ tenantId }: Props) {
  const [summary, setSummary]   = useState<SentimentSummary | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [filter, setFilter]     = useState<Filter>("all");
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const negativeOnly    = filter === "signals" ? "true" : "false";
    const brandSafetyOnly = filter === "flagged"  ? "true" : "false";
    const sentimentQ      = ["positive","negative","neutral","mixed"].includes(filter) ? `&sentiment=${filter}` : "";

    const [sumRes, listRes] = await Promise.all([
      apiFetch<{ summary: SentimentSummary }>(`${apiOrigin}/sentiment/summary`),
      apiFetch<{ comments: SocialComment[] }>(`${apiOrigin}/sentiment?limit=60&negativeOnly=${negativeOnly}&brandSafetyOnly=${brandSafetyOnly}${sentimentQ}`),
    ]);
    if (sumRes.ok)  setSummary(sumRes.data.summary);
    if (listRes.ok) setComments(listRes.data.comments);
    if (!sumRes.ok && !listRes.ok) setLoadError("Failed to load sentiment data.");
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function refresh(scheduleEntryId: string) {
    setRefreshingId(scheduleEntryId);
    await apiFetch(`${apiOrigin}/sentiment/refresh/${scheduleEntryId}`, { method: "POST" });
    await load();
    setRefreshingId(null);
  }

  async function copyResponse(id: string, text: string) {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const total = summary?.totalComments ?? 0;

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <h2 className="sp-title">💬 Sentiment</h2>
        <div className="sp-header-actions">
          <button className="sp-reload-btn" onClick={load} disabled={loading}>
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {loading && (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="sp-skeleton sp-skeleton-line" />
          ))}
        </>
      )}

      {!loading && loadError && (
        <div className="sp-load-error">
          <p>{loadError}</p>
          <button className="sp-reload-btn" onClick={load}>Retry</button>
        </div>
      )}

      {!loading && (
        <>
          {/* Sentiment gauge */}
          {summary && total > 0 && (
            <div className="sp-gauge-row">
              {[
                { key: "positive", label: "Positive", count: summary.positiveCount },
                { key: "negative", label: "Negative", count: summary.negativeCount },
                { key: "neutral",  label: "Neutral",  count: summary.neutralCount  },
                { key: "mixed",    label: "Mixed",    count: summary.mixedCount    },
              ].map(({ key, label, count }) => (
                <div
                  key={key}
                  className={`sp-gauge-card sp-gauge-card--${key}`}
                  onClick={() => setFilter(filter === key ? "all" : key as Filter)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="sp-gauge-pct">{pct(count, total)}</span>
                  <span className="sp-gauge-label">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Alert banners */}
          {summary && (summary.negativeSignalCount > 0 || summary.brandSafetyFlagCount > 0) && (
            <div className="sp-alerts">
              {summary.negativeSignalCount > 0 && (
                <div className="sp-alert sp-alert--danger">
                  <span className="sp-alert-icon">⚠️</span>
                  Comments require action
                  <span className="sp-alert-count">{summary.negativeSignalCount}</span>
                </div>
              )}
              {summary.brandSafetyFlagCount > 0 && (
                <div className="sp-alert sp-alert--warning">
                  <span className="sp-alert-icon">🚩</span>
                  Brand safety flags detected
                  <span className="sp-alert-count">{summary.brandSafetyFlagCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Top topics */}
          {summary && summary.topTopics.length > 0 && (
            <div className="sp-topics-row">
              <span className="sp-topic-label">Topics</span>
              {summary.topTopics.slice(0, 8).map(t => (
                <span key={t.topic} className="sp-topic-pill">
                  {t.topic}
                  <span className="sp-topic-count">{t.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="sp-filter-row">
            <span className="sp-filter-label">Filter</span>
            {([
              { id: "all",      label: "All" },
              { id: "positive", label: "😊 Positive" },
              { id: "negative", label: "😠 Negative" },
              { id: "neutral",  label: "😐 Neutral"  },
              { id: "signals",  label: "⚠️ Needs Action", cls: "danger"  },
              { id: "flagged",  label: "🚩 Safety",       cls: "warning" },
            ] as Array<{ id: Filter; label: string; cls?: string }>).map(f => (
              <button
                key={f.id}
                className={[
                  "sp-filter-btn",
                  filter === f.id ? "sp-filter-btn--active" : "",
                  f.cls ? `sp-filter-btn--${f.cls}` : "",
                ].join(" ")}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {comments.length > 0 && (
            <div className="sp-section-header">
              <span className="sp-section-title">Comments</span>
              <span className="sp-section-count">{comments.length} shown</span>
            </div>
          )}

          {/* Comment list */}
          {comments.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">💬</div>
              <p className="sp-empty-text">
                No comments yet. Select a post below and tap Refresh to pull live comments.
              </p>
            </div>
          ) : (
            <div className="sp-list">
              {comments.map(c => (
                <div
                  key={c.id}
                  className={[
                    "sp-comment",
                    c.brandSafetyFlags.length > 0 ? "sp-comment--warning" :
                    c.isNegativeSignal            ? "sp-comment--negative" :
                    c.sentimentScore === "positive" ? "sp-comment--positive" : "",
                  ].join(" ")}
                >
                  <div className="sp-comment-header">
                    <span className="sp-author">{c.authorName ?? "Anonymous"}</span>
                    <SentimentBadge score={c.sentimentScore} />
                    <span className="sp-network-badge">{c.network}</span>
                    <span className="sp-comment-meta">{relTime(c.postedAt ?? c.createdAt)}</span>
                    <button
                      className="sp-refresh-btn"
                      onClick={() => refresh(c.scheduleEntryId)}
                      disabled={refreshingId === c.scheduleEntryId}
                    >
                      {refreshingId === c.scheduleEntryId ? "…" : "↻"}
                    </button>
                  </div>

                  <p className="sp-comment-body">{c.body}</p>

                  {/* Brand safety flags */}
                  {c.brandSafetyFlags.length > 0 && (
                    <div className="sp-flags">
                      {c.brandSafetyFlags.map(f => (
                        <span key={f} className="sp-flag">{FLAG_LABELS[f]}</span>
                      ))}
                    </div>
                  )}

                  {/* Topics */}
                  {c.topics.length > 0 && (
                    <div className="sp-comment-topics">
                      {c.topics.map(t => (
                        <span key={t} className="sp-ctopic">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Suggested response */}
                  {c.suggestedResponse && (
                    <div className="sp-response">
                      <span className="sp-response-label">Suggested response</span>
                      <p className="sp-response-text">"{c.suggestedResponse}"</p>
                      <button
                        className="sp-copy-btn"
                        onClick={() => copyResponse(c.id, c.suggestedResponse!)}
                      >
                        {copied === c.id ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  )}

                  {/* Memory indicator */}
                  {c.fedToMemory && (
                    <span style={{ fontSize: "0.58rem", opacity: 0.4, color: "var(--text)" }}>
                      ✓ Fed to brand memory
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
