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

/** One file name directly inside a user's folder, as `uploadAvatar` writes it ("avatar.png"). */
const AVATAR_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9]+)?$/;

/**
 * True for a public URL of a file directly inside `userId`'s own folder of this
 * project's `avatars` bucket, which is the only place `uploadAvatar` writes.
 * The URL is parsed rather than searched, so the host must be this project's
 * Supabase and dot segments are resolved before the folder is compared.
 */
export function isOwnAvatarUpload(url: string, userId: string, supabaseUrl: string): boolean {
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (parsed.origin !== base.origin || parsed.username || parsed.password) return false;
  const folder = `${base.pathname.replace(/\/$/, "")}/storage/v1/object/public/avatars/${userId}/`;
  if (!parsed.pathname.startsWith(folder)) return false;
  return AVATAR_FILE_RE.test(parsed.pathname.slice(folder.length));
}

/**
 * Whether a profile save may set `avatar_url` to `next`.
 *
 * Allowed: leaving it alone (undefined), removing the photo (null), keeping the
 * value the profile already has, or one of the user's own uploads. Keeping the
 * stored value matters because first sign-in copies the Google photo into the
 * profile, and the forms send the avatar back unchanged; refusing it left new
 * teammates stuck on the welcome screen. Anything else is refused, so nobody
 * can point their avatar at someone else's upload or at an arbitrary site.
 */
export function avatarUrlAllowed(
  next: string | null | undefined,
  { current, userId, supabaseUrl }: { current: string | null; userId: string; supabaseUrl: string },
): boolean {
  if (next === undefined || next === null) return true;
  if (current !== null && next === current) return true;
  return isOwnAvatarUpload(next, userId, supabaseUrl);
}
