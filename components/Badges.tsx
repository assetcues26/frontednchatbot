"use client";

/** Shared visual language for roles, sensitivity levels and document status. */

export const SENSITIVITY_LABEL: Record<number, string> = {
  1: "Public",
  2: "Customer",
  3: "Internal",
  4: "Restricted",
};

export function SensitivityBadge({ level }: { level: number }) {
  return (
    <span className={`badge sens-${level}`} title={`Sensitivity level ${level}`}>
      L{level} {SENSITIVITY_LABEL[level] ?? "Unknown"}
    </span>
  );
}

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-ink-900 text-white ring-ink-900",
  product: "bg-violet-50 text-violet-800 ring-violet-200",
  engineering: "bg-blue-50 text-blue-800 ring-blue-200",
  qa: "bg-teal-50 text-teal-800 ring-teal-200",
  sales: "bg-orange-50 text-orange-800 ring-orange-200",
  support: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  customer: "bg-ink-100 text-ink-700 ring-ink-200",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`badge ${ROLE_STYLE[role] ?? "bg-ink-100 text-ink-700 ring-ink-200"}`}>
      {role}
    </span>
  );
}

export function RoleBadges({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return <span className="badge bg-ink-100 text-ink-500 ring-ink-200">no roles</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <RoleBadge key={r} role={r} />
      ))}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending_review: "bg-amber-50 text-amber-900 ring-amber-200",
  processing: "bg-ink-100 text-ink-600 ring-ink-200",
  archived: "bg-ink-100 text-ink-500 ring-ink-200",
  failed: "bg-rose-50 text-rose-800 ring-rose-200",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Live",
  pending_review: "Awaiting review",
  processing: "Processing",
  archived: "Archived",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLE[status] ?? "bg-ink-100 text-ink-600 ring-ink-200"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const SEVERITY_STYLE: Record<string, string> = {
  info: "bg-ink-100 text-ink-600 ring-ink-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  critical: "bg-rose-100 text-rose-900 ring-rose-300",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`badge ${SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.info}`}>
      {severity}
    </span>
  );
}
