import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { hubUrl } from "./links";

/**
 * What Potara Hub posts to app/api/hub/notify (the Hub's spec, section 7),
 * and the DM it becomes.
 */

export const TITLE_MAX = 200;
export const BODY_MAX = 4000;

/** The label of the link back to the Hub, as in the Hub's own notification email. */
export const HUB_LINK_LABEL = "Buka di Hub";

/** Characters as the Hub counts them (Postgres length()): an emoji is one, not two UTF-16 units. */
const chars = (s: string) => [...s].length;

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

const schema = z.object({
  // The Hub's notification id, which keeps a retry from posting twice.
  id: z.string().uuid(),
  recipientEmail: z.string().trim().toLowerCase().email().max(254),
  title: z
    .string()
    .transform(oneLine)
    .refine((s) => s.length > 0 && chars(s) <= TITLE_MAX),
  body: z
    .string()
    .refine((s) => chars(s) <= BODY_MAX)
    .default(""),
  url: z.string().max(2000),
});

export type HubNotification = z.infer<typeof schema>;

export type HubNotificationParse =
  | { ok: true; notification: HubNotification }
  | { ok: false; error: "invalid_body" | "invalid_url"; fields: string[] };

/**
 * The request body, checked. `fields` names what was wrong, for the log: the
 * Hub sees only the error code. A link anywhere but the Hub is refused.
 */
export function parseHubNotification(input: unknown): HubNotificationParse {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_body", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] };
  }
  const url = hubUrl(parsed.data.url);
  if (!url) return { ok: false, error: "invalid_url", fields: ["url"] };
  return { ok: true, notification: { ...parsed.data, url } };
}

/** The DM: the title in bold, the body with its line breaks, then the link, like the Hub's email. */
export function hubNotificationDoc({ title, body, url }: Pick<HubNotification, "title" | "body" | "url">): JSONContent {
  const content: JSONContent[] = [{ type: "paragraph", content: [{ type: "text", text: title, marks: [{ type: "bold" }] }] }];
  const lines = body.replace(/\r\n?/g, "\n").trim().split("\n");
  if (lines.some(Boolean)) {
    content.push({
      type: "paragraph",
      content: lines.flatMap((line, i): JSONContent[] => [
        ...(i > 0 ? [{ type: "hardBreak" }] : []),
        ...(line ? [{ type: "text", text: line }] : []),
      ]),
    });
  }
  content.push({
    type: "paragraph",
    content: [{ type: "text", text: HUB_LINK_LABEL, marks: [{ type: "link", attrs: { href: url } }] }],
  });
  return { type: "doc", content };
}
