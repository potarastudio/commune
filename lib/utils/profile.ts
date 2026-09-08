/** Handle rules mirror the profiles_handle_check constraint. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{0,29}$/;
export const HANDLE_MAX = 30;
export const DISPLAY_NAME_MAX = 80;
export const TITLE_MAX = 80;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Lowercase, strip disallowed characters, trim leading punctuation. */
export function normaliseHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+/, "")
    .slice(0, HANDLE_MAX);
}

export function handleProblem(handle: string): string | null {
  if (handle.length === 0) return "Pick a handle.";
  if (handle !== handle.toLowerCase()) return "Use lowercase letters, numbers, dots, dashes or underscores.";
  if (!/^[a-z0-9]/.test(handle)) return "Start with a letter or number.";
  if (!HANDLE_RE.test(handle)) return "Use lowercase letters, numbers, dots, dashes or underscores.";
  if (handle === "channel" || handle === "here" || handle === "everyone") return "That one is reserved for mentions.";
  return null;
}
