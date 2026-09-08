"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser Supabase client (singleton). Use only inside lib/queries and lib/realtime. */
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return client;
}

export type SupabaseBrowserClient = ReturnType<typeof getSupabaseBrowserClient>;
