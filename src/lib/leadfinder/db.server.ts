// Server-only database client for the lead finder.
// Uses the publishable key (RLS applies); never the service role.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getDb(): SupabaseClient {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Opaque sb_ keys aren't JWTs: send only apikey, not Authorization bearer.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
