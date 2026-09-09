import { z } from "zod";

/**
 * Environment validation (§7). Public vars are validated wherever they are
 * imported; server vars are validated at boot via instrumentation.ts and on
 * first use through serverEnv().
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LIVEKIT_URL: z.string().url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  // Shared with the pg_cron job that triggers the mention digest. Optional: unset = digest off.
  CRON_SECRET: z.string().min(16).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}

// NEXT_PUBLIC_* values must be referenced literally so Next can inline them.
export const publicEnv: PublicEnv = (() => {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
})();

let cachedServerEnv: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (!cachedServerEnv) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${formatIssues(parsed.error)}`);
    }
    cachedServerEnv = parsed.data;
  }
  return cachedServerEnv;
}
