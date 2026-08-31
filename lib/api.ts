"use client";

import { getSupabase } from "./supabase";

/**
 * Typed client for the backend.
 *
 * Every call attaches the Supabase access token. Note what is never sent: a
 * role, a tenant, or a clearance. The server derives all of that from the
 * token and its own database. If you find yourself wanting to add one of
 * those to a request body, the backend will ignore it and a test will fail.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session?.access_token) {
    throw new ApiError(401, "Not signed in");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  parse = true,
): Promise<T> {
  const headers = {
    ...(await authHeaders()),
    ...(init.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* the server returned no JSON body */
    }
    throw new ApiError(response.status, detail);
  }

  if (!parse || response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Types (mirrors app/api/schemas.py; regenerate from /openapi.json in CI)
// ---------------------------------------------------------------------------

export interface Me {
  user_id: string;
  email: string;
  display_name: string;
  tenant_slug: string;
  tenant_name: string;
  roles: string[];
  clearance: number;
  is_admin: boolean;
}

export interface Citation {
  key: string;
  document_id: string;
  title: string;
  doc_type: string;
  module: string;
  heading_path: string;
  ordinal: number;
}

export interface Answer {
  answer: string;
  turn_id: string;
  citations: Citation[];
  follow_ups: string[];
  refused: boolean;
  retracted: boolean;
  cached: boolean;
  latency_ms: number;
  chunks_used: number;
}

export interface DocumentRow {
  id: string;
  title: string;
  source_filename: string;
  module: string;
  doc_type: string;
  status: string;
  sensitivity: number;
  version: number;
  byte_size: number;
  declared_audience: string[];
  suggested_role_keys: string[];
  suggested_sensitivity: number | null;
  classifier_rationale: string;
  granted_role_keys: string[];
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  key: string;
  name: string;
  description: string;
  clearance: number;
  is_internal: boolean;
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  tenant_slug: string;
  roles: string[];
  clearance: number;
  is_active: boolean;
  created_at: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  kind: string;
  is_active: boolean;
}

export interface AuditRow {
  id: string;
  event_type: string;
  actor_email: string;
  actor_role_keys: string[];
  document_id: string | null;
  severity: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AuditSummary {
  total_queries: number;
  feedback_up: number;
  feedback_down: number;
  total_refusals: number;
  total_anomalies: number;
  total_retractions: number;
  injections_detected: number;
  acl_version: number;
}

export interface ComparisonEntry {
  role_key: string;
  role_name: string;
  answer: string;
  refused: boolean;
  citations: Citation[];
  chunks_allowed: number;
  documents_blocked: number;
  blocked_titles: string[];
}

export interface Comparison {
  question: string;
  entries: ComparisonEntry[];
  total_matching_chunks: number;
}

export interface IngestResult {
  document_id: string;
  title: string;
  status: string;
  action: string;
  chunks_total: number;
  chunks_embedded: number;
  chunks_reused: number;
  requires_reapproval: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  me: () => request<Me>("/api/me"),

  ask: (question: string, history: string[] = []) =>
    request<Answer>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),

  /** Rate one answer. Only the turn id travels; the server reads the rest
   *  from that turn's audit row. */
  feedback: (
    turnId: string,
    rating: "up" | "down",
    comment = "",
    answer = "",
  ) =>
    request<{ status: string; rating: string }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        turn_id: turnId,
        rating,
        comment,
        answer: answer.slice(0, 8000),
      }),
    }),

  requestAccess: (question: string, justification: string) =>
    request<{ status: string }>("/api/access-request", {
      method: "POST",
      body: JSON.stringify({ question, justification }),
    }),

  compare: (question: string) =>
    request<Comparison>("/api/compare", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  documents: (status?: string) =>
    request<DocumentRow[]>(
      `/api/admin/documents${status ? `?status=${status}` : ""}`,
    ),

  upload: (file: File, module: string) => {
    const form = new FormData();
    form.append("file", file);
    return request<IngestResult>(
      `/api/admin/documents?module=${encodeURIComponent(module)}`,
      { method: "POST", body: form },
    );
  },

  approve: (id: string, roleKeys: string[], sensitivity: number) =>
    request<DocumentRow>(`/api/admin/documents/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ role_keys: roleKeys, sensitivity, note: "" }),
    }),

  revoke: (id: string) =>
    request<DocumentRow>(`/api/admin/documents/${id}/revoke`, {
      method: "POST",
    }),

  deleteDocument: (id: string) =>
    request<{ deleted: boolean; title: string; chunks_removed: number }>(
      `/api/admin/documents/${id}`,
      { method: "DELETE" },
    ),

  roles: () => request<Role[]>("/api/admin/roles"),
  tenants: () => request<Tenant[]>("/api/admin/tenants"),
  users: () => request<UserRow[]>("/api/admin/users"),

  createUser: (body: {
    email: string;
    display_name: string;
    tenant_slug: string;
    role_keys: string[];
  }) =>
    request<UserRow>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  setUserRoles: (id: string, roleKeys: string[]) =>
    request<UserRow>(`/api/admin/users/${id}/roles`, {
      method: "PUT",
      body: JSON.stringify({ role_keys: roleKeys }),
    }),

  setUserActive: (id: string, isActive: boolean) =>
    request<UserRow>(`/api/admin/users/${id}/active`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    }),

  audit: (params: { limit?: number; event_type?: string; severity?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.event_type) q.set("event_type", params.event_type);
    if (params.severity) q.set("severity", params.severity);
    return request<AuditRow[]>(`/api/admin/audit?${q}`);
  },

  auditSummary: () => request<AuditSummary>("/api/admin/audit/summary"),
};

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export interface StreamHandlers {
  onSources?: (sources: { key: string; title: string; doc_type: string }[]) => void;
  onDelta: (text: string) => void;
  onDone: (info: {
    turn_id?: string;
    citations: Citation[];
    follow_ups?: string[];
    refused: boolean;
    cached: boolean;
  }) => void;
  onRetracted: (info: { answer: string; reason: string }) => void;
  onError: (message: string) => void;
}

/**
 * Consume the SSE stream from POST /api/ask/stream.
 *
 * `retracted` matters: citation validation runs after generation, so a
 * streamed answer can be withdrawn. When it fires, replace what was shown
 * rather than appending to it.
 */
export async function askStream(
  question: string,
  handlers: StreamHandlers,
  history: string[] = [],
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE}/api/ask/stream`, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!response.ok || !response.body) {
    handlers.onError(`Request failed (${response.status})`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      if (dataLines.length === 0) continue;

      let payload: unknown;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }

      switch (event) {
        case "sources":
          handlers.onSources?.(payload as { key: string; title: string; doc_type: string }[]);
          break;
        case "delta":
          handlers.onDelta(payload as string);
          break;
        case "done":
          handlers.onDone(
            payload as {
              turn_id?: string;
              citations: Citation[];
              follow_ups?: string[];
              refused: boolean;
              cached: boolean;
            },
          );
          break;
        case "retracted":
          handlers.onRetracted(payload as { answer: string; reason: string });
          break;
        case "error":
          handlers.onError((payload as { message?: string }).message ?? "Unknown error");
          break;
      }
    }
  }
}
