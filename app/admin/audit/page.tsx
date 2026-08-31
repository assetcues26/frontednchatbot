"use client";

import { useCallback, useEffect, useState } from "react";

import { RoleBadges, SeverityBadge } from "@/components/Badges";
import { Shell } from "@/components/Shell";
import { api, type AuditRow, type AuditSummary } from "@/lib/api";

const FILTERS = [
  { label: "Everything", value: "" },
  { label: "Questions", value: "query" },
  { label: "Refusals", value: "query_refused" },
  { label: "Anomalies", value: "security_anomaly" },
  { label: "Retractions", value: "citation_rejected" },
  { label: "Injections", value: "injection_detected" },
  { label: "Feedback", value: "feedback" },
  { label: "Access changes", value: "acl_changed" },
  { label: "Deletions", value: "document_deleted" },
];

export default function AuditPage() {
  return <Shell requireAdmin>{() => <Audit />}</Shell>;
}

function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.audit({ limit: 150, event_type: filter || undefined }),
        api.auditSummary(),
      ]);
      setRows(r);
      setSummary(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the audit log");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Audit</h1>
          <p className="mt-1 text-sm text-ink-600">
            Every question, every access decision, every anomaly. Append-only.
          </p>
        </div>
        <button onClick={() => void load()} className="btn-ghost text-xs">
          Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Questions" value={summary.total_queries} />
          <Stat label="Refusals" value={summary.total_refusals} />
          <Stat
            label="Anomalies"
            value={summary.total_anomalies}
            tone={summary.total_anomalies > 0 ? "bad" : "good"}
            hint="Retrieval and re-verification disagreed. Should always be zero."
          />
          <Stat
            label="Retractions"
            value={summary.total_retractions}
            tone={summary.total_retractions > 0 ? "warn" : "good"}
            hint="Answers withdrawn because a citation could not be traced."
          />
          <Stat
            label="Injections"
            value={summary.injections_detected}
            tone={summary.injections_detected > 0 ? "warn" : "good"}
            hint="Instruction-like text found inside a document."
          />
          <Stat
            label="Rated helpful"
            value={summary.feedback_up}
            tone={summary.feedback_up > 0 ? "good" : "neutral"}
            hint="Answers a reader marked as useful."
          />
          <Stat
            label="Rated wrong"
            value={summary.feedback_down}
            tone={summary.feedback_down > 0 ? "warn" : "neutral"}
            hint="Answers a reader flagged. Filter to Feedback to read the comments."
          />
          <Stat
            label="ACL version"
            value={summary.acl_version}
            hint="Increments on every permission change; invalidates the answer cache."
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              filter === f.value
                ? "bg-ink-900 text-white"
                : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer h-16 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-500">No events yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <EventRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const toneClass = {
    neutral: "text-ink-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-rose-700",
  }[tone];

  return (
    <div className="card animate-pop p-3 transition hover:shadow-md" title={hint}>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-ink-500">{label}</div>
    </div>
  );
}

function EventRow({ row }: { row: AuditRow }) {
  const [open, setOpen] = useState(false);
  const blocked = row.detail.blocked_documents as
    | { id: string; title: string; chunks: number }[]
    | undefined;

  return (
    <div
      className={`card p-3 ${
        row.severity === "critical"
          ? "border-rose-300 bg-rose-50/40"
          : row.severity === "warning"
            ? "border-amber-200"
            : ""
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-700">
              {row.event_type}
            </span>
            {row.severity !== "info" && <SeverityBadge severity={row.severity} />}
            <span className="text-xs text-ink-500">{row.actor_email}</span>
            <RoleBadges roles={row.actor_role_keys} />
          </div>

          {typeof row.detail.rating === "string" && (
            <span
              className={`badge mr-1 ${
                row.detail.rating === "up"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-rose-50 text-rose-800 ring-rose-200"
              }`}
            >
              {row.detail.rating === "up" ? "helpful" : "flagged"}
            </span>
          )}

          {typeof row.detail.question === "string" && (
            <p className="mt-1 truncate text-xs text-ink-600">
              &ldquo;{row.detail.question}&rdquo;
            </p>
          )}
          {typeof row.detail.comment === "string" && row.detail.comment && (
            <p className="mt-1 text-xs text-ink-700">
              Comment: {row.detail.comment}
            </p>
          )}

          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-500">
            <span>{new Date(row.created_at).toLocaleString()}</span>
            {typeof row.detail.chunks_used === "number" && (
              <span>{row.detail.chunks_used} chunks used</span>
            )}
            {blocked && blocked.length > 0 && (
              <span className="text-rose-600">
                {blocked.length} document{blocked.length === 1 ? "" : "s"} withheld
              </span>
            )}
            {typeof row.detail.latency_ms === "number" && (
              <span>{row.detail.latency_ms} ms</span>
            )}
          </div>
        </div>
        <span className="text-ink-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-950 p-3 text-[11px] leading-relaxed text-ink-100">
          {JSON.stringify(row.detail, null, 2)}
        </pre>
      )}
    </div>
  );
}
