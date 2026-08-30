"use client";

import { useCallback, useEffect, useState } from "react";

import { RoleBadges } from "@/components/Badges";
import { Shell } from "@/components/Shell";
import { api, type Role, type Tenant, type UserRow } from "@/lib/api";

export default function UsersPage() {
  return <Shell requireAdmin>{() => <Users />}</Shell>;
}

function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, r, t] = await Promise.all([
        api.users(),
        api.roles(),
        api.tenants(),
      ]);
      setUsers(u);
      setRoles(r);
      setTenants(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Users and roles</h1>
          <p className="mt-1 text-sm text-ink-600">
            Role changes apply on the person&apos;s next request — an existing
            session cannot outlive a revocation.
          </p>
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          {adding ? "Cancel" : "Add user"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {adding && (
        <AddUser
          roles={roles}
          tenants={tenants}
          onDone={async () => {
            setAdding(false);
            await load();
          }}
          setError={setError}
        />
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            roles={roles}
            onChanged={load}
            setError={setError}
          />
        ))}
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold">Clearance reference</h2>
        <p className="mt-1 text-xs text-ink-600">
          Clearance is a ceiling, not a grant. A role reads nothing until a
          document is explicitly granted to it — both conditions are required.
        </p>
        <div className="mt-3 space-y-1.5">
          {roles.map((role) => (
            <div key={role.key} className="flex gap-3 text-xs">
              <span className="w-28 shrink-0 font-medium">{role.name}</span>
              <span className="w-8 shrink-0 text-ink-500">c{role.clearance}</span>
              <span className="text-ink-600">{role.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddUser({
  roles,
  tenants,
  onDone,
  setError,
}: {
  roles: Role[];
  tenants: Tenant[];
  onDone: () => Promise<void>;
  setError: (v: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tenant, setTenant] = useState(tenants[0]?.slug ?? "assetcues");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser({
        email,
        display_name: name,
        tenant_slug: tenant,
        role_keys: selected,
      });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Email</label>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Tenant</label>
          <select
            className="input"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.kind})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium">Roles</label>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(role.key)
                    ? prev.filter((k) => k !== role.key)
                    : [...prev, role.key],
                )
              }
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                selected.includes(role.key)
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              {role.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-500">
        The person signs in through Supabase. Their account links on first
        sign-in with this email.
      </p>

      <button type="submit" disabled={busy} className="btn-primary text-xs">
        {busy ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

function UserCard({
  user,
  roles,
  onChanged,
  setError,
}: {
  user: UserRow;
  roles: Role[];
  onChanged: () => Promise<void>;
  setError: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(user.roles);
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card overflow-hidden ${user.is_active ? "" : "opacity-60"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-ink-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{user.email}</span>
            {!user.is_active && (
              <span className="badge bg-rose-50 text-rose-800 ring-rose-200">
                disabled
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span>{user.tenant_slug}</span>
            <span>· clearance {user.clearance}</span>
            <RoleBadges roles={user.roles} />
          </div>
        </div>
        <span className="text-ink-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-100 bg-ink-50/50 p-4">
          <label className="mb-1.5 block text-xs font-medium">Roles</label>
          <div className="mb-3 flex flex-wrap gap-2">
            {roles.map((role) => (
              <button
                key={role.key}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(role.key)
                      ? prev.filter((k) => k !== role.key)
                      : [...prev, role.key],
                  )
                }
                title={role.description}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  selected.includes(role.key)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                }`}
              >
                {role.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() =>
                run("Save", () => api.setUserRoles(user.id, selected))
              }
              className="btn-primary text-xs"
            >
              Save roles
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run("Update", () =>
                  api.setUserActive(user.id, !user.is_active),
                )
              }
              className={user.is_active ? "btn-danger text-xs" : "btn-ghost text-xs"}
            >
              {user.is_active ? "Disable account" : "Re-enable account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
