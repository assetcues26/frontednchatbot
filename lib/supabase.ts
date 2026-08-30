"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * The anon key is designed to be public. It authenticates the *project*, not
 * the user, and every request it makes is still subject to the backend's JWT
 * verification. The service-role key must never appear in this repository.
 */
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
          "Copy .env.example to .env.local and fill them in.",
      );
    }
    client = createBrowserClient(url, key);
  }
  return client;
}
