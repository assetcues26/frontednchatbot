"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SENSITIVITY_LABEL,
  RoleBadge,
  SensitivityBadge,
  StatusBadge,
} from "@/components/Badges";
import { Shell } from "@/components/Shell";
import { api, type DocumentRow, type Role } from "@/lib/api";

export default function DocumentsPage() {
  return <Shell requireAdmin>{() => <Documents />}</Shell>;
}

function Documents() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([api.documents(), api.roles()]);
      setDocs(d);
      setRoles(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.upload(file, "");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const pending = docs.filter((d) => d.status === "pending_review");
  const live = docs.filter((d) => d.status === "approved");
  const other = docs.filter(
    (d) => d.status !== "pending_review" && d.status !== "approved",
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Documents</h1>
          <p className="mt-1 text-sm text-ink-600">
            An uploaded document is readable by nobody until you approve it.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".docx,.xlsx,.pdf,.md,.txt"
            onChange={(e) => upload(e.target.files)}
            className="hidden"
            id="upload"
          />
          <label htmlFor="upload" className="btn-primary cursor-pointer">
            {busy === "upload" ? "Uploading…" : "Upload documents"}
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <Section
          title="Awaiting review"
          count={pending.length}
          note="Not retrievable by anyone, including you, until approved."
        >
          {pending.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              roles={roles}
              onChanged={load}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              expanded
            />
          ))}
        </Section>
      )}

      <Section title="Live" count={live.length}>
        {live.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nothing is live yet. Approve a document to make it answerable.
          </p>
        ) : (
          live.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              roles={roles}
              onChanged={load}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
            />
          ))
        )}
      </Section>

      {other.length > 0 && (
        <Section title="Other" count={other.length}>
          {other.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              roles={roles}
              onChanged={load}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  note,
  children,
}: {
  title: string;
  count: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          {title} <span className="text-ink-400">({count})</span>
        </h2>
        {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DocumentCard({
  doc,
  roles,
  onChanged,
  busy,
  setBusy,
  setError,
  expanded = false,
}: {
  doc: DocumentRow;
  roles: Role[];
  onChanged: () => Promise<void>;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded);
  const [sensitivity, setSensitivity] = useState(
    doc.status === "approved"
      ? doc.sensitivity
      : (doc.suggested_sensitivity ?? doc.sensitivity),
  );
  const [selected, setSelected] = useState<string[]>(
    doc.status === "approved" ? doc.granted_role_keys : doc.suggested_role_keys,
  );

  const working = busy === doc.id;

  // A grant to a role whose clearance is below the chosen sensitivity would be
  // a dead row: the retrieval predicate would ignore it. The API rejects it,
  // so surface it here rather than letting the admin discover it in an error.
  const blocked = roles.filter(
    (r) => selected.includes(r.key) && r.clearance < sensitivity,
  );

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(doc.id);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-ink-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{doc.title}</span>
            <StatusBadge status={doc.status} />
            {doc.status === "approved" && (
              <SensitivityBadge level={doc.sensitivity} />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span>{doc.doc_type}</span>
            {doc.module && <span>· {doc.module}</span>}
            <span>· {doc.chunk_count} chunks</span>
            <span>· v{doc.version}</span>
            <span>· {(doc.byte_size / 1024).toFixed(0)} KB</span>
          </div>
          {doc.status === "approved" && (
            <div className="mt-2 flex flex-wrap gap-1">
              {doc.granted_role_keys.length === 0 ? (
                <span className="text-xs text-rose-600">
                  Live but granted to no role — unreachable
                </span>
              ) : (
                doc.granted_role_keys.map((r) => <RoleBadge key={r} role={r} />)
              )}
            </div>
          )}
        </div>
        <span className="mt-1 text-ink-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-100 bg-ink-50/50 p-4">
          {doc.classifier_rationale && (
            <div className="mb-4 rounded-lg bg-white p-3 text-xs ring-1 ring-inset ring-ink-200">
              <p className="mb-1 font-medium text-ink-700">
                Suggested: L{doc.suggested_sensitivity}{" "}
                {SENSITIVITY_LABEL[doc.suggested_sensitivity ?? 4]} for{" "}
                {doc.suggested_role_keys.join(", ") || "nobody"}
              </p>
              <p className="text-ink-600">{doc.classifier_rationale}</p>
              {doc.declared_audience.length > 0 && (
                <p className="mt-2 text-ink-500">
                  The document states its audience as:{" "}
                  <span className="text-ink-700">
                    {doc.declared_audience.join(", ")}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium">
              Sensitivity
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  onClick={() => setSensitivity(level)}
                  className={`badge cursor-pointer ${
                    sensitivity === level
                      ? `sens-${level} ring-2`
                      : "bg-white text-ink-500 ring-ink-200"
                  }`}
                >
                  L{level} {SENSITIVITY_LABEL[level]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium">
              Who can read this
            </label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const on = selected.includes(role.key);
                const tooLow = role.clearance < sensitivity;
                return (
                  <button
                    key={role.key}
                    onClick={() => toggle(role.key)}
                    title={
                      tooLow
                        ? `${role.name} has clearance ${role.clearance}; it cannot be granted a level ${sensitivity} document.`
                        : role.description
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      on
                        ? tooLow
                          ? "border-rose-300 bg-rose-50 text-rose-800"
                          : "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                    }`}
                  >
                    {role.name}
                    <span className="ml-1 text-[10px] opacity-60">
                      c{role.clearance}
                    </span>
                  </button>
                );
              })}
            </div>
            {blocked.length > 0 && (
              <p className="mt-2 text-xs text-rose-700">
                {blocked.map((r) => r.name).join(", ")} cannot be granted a
                level {sensitivity} document — their clearance is lower, so the
                grant would have no effect. Lower the sensitivity or deselect
                them.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={working || selected.length === 0 || blocked.length > 0}
              onClick={() =>
                run("Approve", () =>
                  api.approve(doc.id, selected, sensitivity),
                )
              }
              className="btn-primary text-xs"
            >
              {doc.status === "approved" ? "Update access" : "Approve & publish"}
            </button>

            {doc.status === "approved" && (
              <button
                disabled={working}
                onClick={() => run("Revoke", () => api.revoke(doc.id))}
                className="btn-ghost text-xs"
              >
                Take offline
              </button>
            )}

            <button
              disabled={working}
              onClick={() => {
                if (
                  !confirm(
                    `Delete "${doc.title}"?\n\nThis removes the document and all ${doc.chunk_count} of its chunks and embeddings. The audit trail is kept. This cannot be undone.`,
                  )
                )
                  return;
                void run("Delete", () => api.deleteDocument(doc.id));
              }}
              className="btn-danger ml-auto text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
