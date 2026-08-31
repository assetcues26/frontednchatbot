"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError, type Me } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { RoleBadges } from "./Badges";
import { LogoAnimation, Mark, Wordmark } from "./Brand";

/**
 * Authenticated shell.
 *
 * It renders admin navigation based on `me.is_admin`, which comes from the
 * server. That is a convenience, not a control: hiding a link protects
 * nothing, and every admin route re-checks the role server-side. If this
 * component were compromised, the API would still refuse.
 */
export function Shell({
  children,
  requireAdmin = false,
}: {
  children: (me: Me) => React.ReactNode;
  requireAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((value) => !cancelled && setMe(value))
      .catch(async (err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // Supabase may hold a perfectly valid session while the API still
          // rejects the token -- a JWT the backend cannot verify, or an
          // account with no `users` row yet. Redirecting to /login would
          // bounce straight back here (login sees the session and forwards),
          // so clear the session and say what happened instead.
          await getSupabase().auth.signOut();
          setError(
            "You are signed in with Supabase, but the API did not accept the " +
              "session. Your account may not have been set up in the " +
              "application yet. Please sign in again, or ask an administrator.",
          );
          return;
        }
        setError(
          err instanceof Error ? err.message : "Could not load your account",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <Centered>
        <div className="card animate-pop max-w-md p-6">
          <Wordmark className="mb-4 h-6 w-auto" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-600">{error}</p>
          <p className="mt-4 text-xs text-ink-500">
            If this persists, check that the API is running and that
            NEXT_PUBLIC_API_BASE_URL points at it.
          </p>
          <Link href="/login" className="btn-primary mt-4">
            Back to sign in
          </Link>
        </div>
      </Centered>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-4">
        <div className="flex flex-col items-center">
          <div className="aspect-[733/480] w-64">
            <LogoAnimation surface="#ffffff" />
          </div>
          <p className="-mt-2 text-sm text-ink-500">Signing you in…</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !me.is_admin) {
    return (
      <Centered>
        <div className="card animate-pop max-w-md p-6">
          <h1 className="text-lg font-semibold">Administrators only</h1>
          <p className="mt-2 text-sm text-ink-600">
            Your roles: <RoleBadges roles={me.roles} />
          </p>
          <Link href="/chat" className="btn-primary mt-4">
            Back to chat
          </Link>
        </div>
      </Centered>
    );
  }

  const nav = [
    { href: "/chat", label: "Chat", admin: false },
    { href: "/admin/documents", label: "Documents", admin: true },
    { href: "/admin/users", label: "Users", admin: true },
    { href: "/admin/compare", label: "Compare roles", admin: true },
    { href: "/admin/audit", label: "Audit", admin: true },
  ].filter((item) => !item.admin || me.is_admin);

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link
            href="/chat"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="AssetCues Assistant"
          >
            {/* The mark animates on hover: alive without being restless. */}
            <span className="relative size-9 overflow-hidden rounded-lg bg-white ring-1 ring-ink-200/70 transition group-hover:ring-brand-300">
              <Mark className="size-full object-contain p-1 transition duration-300 group-hover:opacity-0" />
              <span className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                <LogoAnimation surface="#ffffff" />
              </span>
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              Assistant
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-ink-100 font-medium text-ink-900"
                      : "text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium">{me.email}</div>
              <div className="text-[11px] text-ink-500">{me.tenant_name}</div>
            </div>
            <RoleBadges roles={me.roles} />
            <button onClick={signOut} className="btn-ghost text-xs">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main key={pathname} className="animate-rise mx-auto max-w-7xl px-4 py-6">
        {children(me)}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">{children}</div>
  );
}
