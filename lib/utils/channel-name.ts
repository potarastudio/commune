/** Channel name rules mirror the channels_name_check constraint: [a-z0-9-], max 40. */
export const CHANNEL_NAME_RE = /^[a-z0-9-]{1,40}$/;

/** Slack-style normalisation: "Design Reviews!" -> "design-reviews". */
export function normaliseChannelName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function channelNameProblem(name: string): string | null {
  if (name.length === 0) return "Give the channel a name.";
  if (!CHANNEL_NAME_RE.test(name)) return "Use lowercase letters, numbers and dashes.";
  return null;
}
