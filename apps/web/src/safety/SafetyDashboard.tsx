import { useState, useEffect, useCallback } from "react";
import type { ContentScanResult, AnomalyEvent } from "@home-link/marketer-pro-contract";
import "./safety.css";

const API = import.meta.env.VITE_SAFETY_API_ORIGIN ?? "http://localhost:8807";
const WS_ID = "default";
const headers = { "Content-Type": "application/json", "x-workspace-id": WS_ID };

type Tab = "scan" | "history" | "anomalies" | "deletion";

export function SafetyDashboard() {
  const [tab, setTab] = useState<Tab>("scan");
  const [unacked, setUnacked] = useState(0);

  useEffect(() => {
    fetch(`${API}/anomalies`, { headers }).then(r => r.json()).then(d => setUnacked(d.unacknowledgedCount ?? 0)).catch(() => null);
  }, [tab]);

  return (
    <div className="sd-root">
      <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Safety &amp; Compliance</h2>
      <div className="sd-tabs">
        {(["scan", "history", "anomalies", "deletion"] as Tab[]).map(t => (
          <button key={t} className={`sd-tab${tab === t ? " sd-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t === "scan" ? "Scan" : t === "history" ? "History" : t === "anomalies" ? (
              <>Anomalies{unacked > 0 && <span className="sd-tab-badge">{unacked}</span>}</>
            ) : "Account Deletion"}
          </button>
        ))}
      </div>
      {tab === "scan" && <ScanTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "anomalies" && <AnomaliesTab onAckChange={() => setUnacked(u => Math.max(0, u - 1))} />}
      {tab === "deletion" && <DeletionTab />}
    </div>
  );
}

/* ---------- Scan tab ---------- */

function ScanTab() {
  const [text, setText] = useState("");
  const [autoRemediate, setAutoRemediate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentScanResult | null>(null);

  async function scan() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/scan`, {
        method: "POST", headers,
        body: JSON.stringify({ text, autoRemediate }),
      });
      setResult(await r.json());
    } finally { setLoading(false); }
  }

  return (
    <div className="sd-scan-form">
      <textarea placeholder="Paste marketing copy to scan…" value={text} onChange={e => setText(e.target.value)} />
      <div className="sd-scan-options">
        <label>
          <input type="checkbox" checked={autoRemediate} onChange={e => setAutoRemediate(e.target.checked)} />
          Auto-remediate
        </label>
        <button className="sd-btn sd-btn--primary" onClick={scan} disabled={loading || !text.trim()}>
          {loading ? "Scanning…" : "Scan"}
        </button>
      </div>
      {result && <ScanResultCard result={result} />}
    </div>
  );
}

function ScanResultCard({ result }: { result: ContentScanResult }) {
  return (
    <div className="sd-result">
      <div className="sd-result-header">
        <h3>Scan Result</h3>
        <span className={`sd-sev sd-sev--${result.overallSeverity}`}>{result.overallSeverity}</span>
        <span className={result.passed ? "sd-passed" : "sd-failed"}>{result.passed ? "✓ Passed" : "✗ Failed"}</span>
      </div>
      {result.findings.length === 0 && <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No issues found.</p>}
      <div className="sd-findings">
        {result.findings.map((f, i) => (
          <div key={i} className="sd-finding">
            <span className={`sd-sev sd-sev--${f.severity}`}>{f.severity}</span>
            <span className="sd-finding-code">{f.code}</span>
            <span className="sd-finding-msg">{f.message}</span>
            {f.suggestion && <span className="sd-finding-suggest">{f.suggestion}</span>}
          </div>
        ))}
      </div>
      {result.remediatedText && (
        <div style={{ marginTop: "1rem" }}>
          <strong style={{ fontSize: "0.875rem" }}>Remediated:</strong>
          <p style={{ fontSize: "0.85rem", color: "#374151", background: "#fff", border: "1px solid #d1fae5", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.5rem" }}>
            {result.remediatedText}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- History tab ---------- */

function HistoryTab() {
  const [scans, setScans] = useState<ContentScanResult[]>([]);
  const [selected, setSelected] = useState<ContentScanResult | null>(null);

  useEffect(() => {
    fetch(`${API}/scans`, { headers }).then(r => r.json()).then(setScans).catch(() => null);
  }, []);

  return (
    <div>
      {selected ? (
        <div>
          <button className="sd-btn sd-btn--sm" onClick={() => setSelected(null)} style={{ marginBottom: "1rem" }}>← Back</button>
          <ScanResultCard result={selected} />
        </div>
      ) : (
        <div className="sd-scan-list">
          {scans.length === 0 && <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No scans yet.</p>}
          {scans.map(s => (
            <div key={s.id} className="sd-scan-item" onClick={() => setSelected(s)}>
              <span className={`sd-sev sd-sev--${s.overallSeverity}`}>{s.overallSeverity}</span>
              <span className="sd-scan-findings-count">{s.findings.length} finding{s.findings.length !== 1 ? "s" : ""}</span>
              <span className="sd-scan-meta">{s.entityType ? `${s.entityType} / ${s.entityId}` : "ad-hoc"} · {new Date(s.scannedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Anomalies tab ---------- */

function AnomaliesTab({ onAckChange }: { onAckChange: () => void }) {
  const [events, setEvents] = useState<AnomalyEvent[]>([]);
  const [detecting, setDetecting] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/anomalies`, { headers }).then(r => r.json()).then(d => setEvents(d.events ?? [])).catch(() => null);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function detect() {
    setDetecting(true);
    try {
      await fetch(`${API}/anomalies/detect`, { method: "POST", headers });
      load();
    } finally { setDetecting(false); }
  }

  async function acknowledge(id: string) {
    await fetch(`${API}/anomalies/${id}/acknowledge`, { method: "POST", headers });
    setEvents(ev => ev.map(e => e.id === id ? { ...e, acknowledgedAt: new Date().toISOString() } : e));
    onAckChange();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <button className="sd-btn sd-btn--primary" onClick={detect} disabled={detecting}>
          {detecting ? "Detecting…" : "Run Detection"}
        </button>
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Checks for publish spikes, off-hours activity, rapid failures</span>
      </div>
      <div className="sd-anomaly-list">
        {events.length === 0 && <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No anomalies detected.</p>}
        {events.map(e => (
          <div key={e.id} className={`sd-anomaly${e.acknowledgedAt ? " sd-anomaly--acked" : ""}`}>
            <span className={`sd-sev sd-sev--${e.severity}`}>{e.severity}</span>
            <div className="sd-anomaly-body">
              <div className="sd-anomaly-type">{e.type.replace(/_/g, " ")}</div>
              <div className="sd-anomaly-desc">{e.description}</div>
              <div className="sd-anomaly-time">{new Date(e.createdAt).toLocaleString()}</div>
            </div>
            {!e.acknowledgedAt && (
              <button className="sd-btn sd-btn--sm" onClick={() => acknowledge(e.id)}>Acknowledge</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Deletion tab ---------- */

function DeletionTab() {
  const [status, setStatus] = useState<{ scheduledAt?: string; status?: string } | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/account-deletion`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => setStatus(d ? { scheduledAt: d.scheduledAt, status: d.status } : null))
      .catch(() => null);
  }, []);

  async function request() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/account-deletion`, {
        method: "POST", headers,
        body: JSON.stringify({ requestedByUserId: "current_user", reason, scheduleDelayHours: 72 }),
      });
      const d = await r.json();
      setStatus({ scheduledAt: d.scheduledAt, status: d.status });
    } finally { setLoading(false); }
  }

  async function cancel() {
    await fetch(`${API}/account-deletion`, { method: "DELETE", headers });
    setStatus(null);
  }

  return (
    <div className="sd-deletion">
      <h3>Account &amp; Data Deletion (GDPR)</h3>
      <p>Request permanent deletion of all workspace data. A 72-hour cancellation window applies before deletion executes.</p>
      {status?.scheduledAt ? (
        <div className="sd-deletion-status">
          <span className="sd-deletion-scheduled">Deletion scheduled: {new Date(status.scheduledAt).toLocaleString()}</span>
          <div className="sd-deletion-actions" style={{ marginTop: "0.75rem" }}>
            <button className="sd-btn sd-btn--sm" onClick={cancel}>Cancel Request</button>
          </div>
        </div>
      ) : (
        <div className="sd-deletion-form">
          <textarea
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <div className="sd-deletion-actions">
            <button className="sd-btn sd-btn--danger" onClick={request} disabled={loading}>
              {loading ? "Requesting…" : "Request Deletion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
