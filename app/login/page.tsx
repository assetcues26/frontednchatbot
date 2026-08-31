"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoAnimation, Wordmark } from "@/components/Brand";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/chat");
      })
      .catch(() => {
        /* not configured yet; stay on the login page */
      });
  }, [router]);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const { error: err } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/chat` },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/chat");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: the brand.

          This half is pure white deliberately. The animation has no alpha
          channel -- its artwork sits on a white field -- so the only way that
          field disappears entirely is for what sits behind it to be the same
          white. Any tint, gradient or wash here and the video's own rectangle
          shows up as a visible box. */}
      <section className="relative flex flex-col items-center justify-center bg-white px-8 py-14">
        <div className="w-full max-w-md">
          <div className="animate-pop relative mx-auto aspect-[733/480] w-full max-w-sm">
            <LogoAnimation surface="#ffffff" />
          </div>

          <div className="mt-4 flex flex-col items-center text-center">
            <Wordmark className="animate-rise h-8 w-auto" />
            <p
              className="animate-rise mt-6 max-w-sm text-sm leading-relaxed text-ink-500"
              style={{ animationDelay: "120ms" }}
            >
              Every answer is drawn only from the documentation your role is
              cleared to read, and every claim is cited back to its source.
            </p>
          </div>
        </div>

        {/* A hairline rather than a hard seam between the halves. */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-ink-200 to-transparent lg:block"
        />
      </section>

      {/* Right: the form, on the app's own surface colour. */}
      <section className="relative flex items-center justify-center overflow-hidden bg-ink-50 px-6 py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(40rem 24rem at 80% 0%, var(--color-aqua-100), transparent 65%)," +
              "radial-gradient(36rem 22rem at 10% 100%, var(--color-flare-100), transparent 65%)",
          }}
        />

        <div className="relative w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">
            Documentation Assistant
          </h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to continue.</p>

          <div className="card animate-pop mt-6 p-6">
            <button
              onClick={signInWithGoogle}
              disabled={busy}
              className="btn w-full border border-ink-200 bg-white hover:bg-ink-50"
            >
              <GoogleMark />
              Sign in with Google
            </button>
            <p className="mt-2 text-center text-xs text-ink-500">
              For AssetCues staff
            </p>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-200" />
              <span className="text-xs text-ink-400">or</span>
              <div className="h-px flex-1 bg-ink-200" />
            </div>

            <form onSubmit={signInWithPassword} className="space-y-3">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-3 text-center text-xs text-ink-500">
              Customer accounts are created by an administrator.
            </p>

            {error && (
              <p className="animate-rise mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
