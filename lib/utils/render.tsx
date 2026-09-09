import type { JSONContent } from "@tiptap/core";
import { EmojiText } from "@/components/emoji/emoji";
import { MentionChip } from "@/components/profile/mention-chip";
import { mayContainShortcode } from "@/lib/utils/custom-emoji";
import { Fragment, type ReactNode } from "react";

/**
 * renderContent(tiptapJson) — the single place Tiptap JSON becomes React (§7).
 * Links are sanitised to http(s)/mailto and open in a new tab with noopener;
 * mentions render as chips (the profile card hooks in via data attributes).
 */

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function sanitizeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  try {
    const url = new URL(href.trim());
    return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

type Mark = NonNullable<JSONContent["marks"]>[number];

function applyMarks(text: ReactNode, marks: Mark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return text;
  return marks.reduce<ReactNode>((node, mark, i) => {
    const k = `${key}-m${i}`;
    switch (mark.type) {
      case "bold":
        return <strong key={k}>{node}</strong>;
      case "italic":
        return <em key={k}>{node}</em>;
      case "strike":
        return <s key={k}>{node}</s>;
      case "code":
        return (
          <code
            key={k}
            className="rounded-[5px] border border-border-subtle bg-bg-chip px-[5px] py-px font-mono text-[12.5px] text-body"
          >
            {node}
          </code>
        );
      case "link": {
        const href = sanitizeHref(mark.attrs?.href);
        if (!href) return node;
        return (
          <a
            key={k}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link-ink"
          >
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, text);
}

function renderNode(node: JSONContent, key: string): ReactNode {
  const children = (node.content ?? []).map((child, i) => renderNode(child, `${key}-${i}`));

  switch (node.type) {
    case "doc":
      return <Fragment key={key}>{children}</Fragment>;
    case "paragraph":
      return (
        <p key={key} className="min-h-[1.5em] whitespace-pre-wrap break-words">
          {children}
        </p>
      );
    case "heading":
      return (
        <p key={key} className="font-semibold whitespace-pre-wrap break-words">
          {children}
        </p>
      );
    case "text": {
      const text = node.text ?? "";
      const inCode = node.marks?.some((m) => m.type === "code");
      const body = !inCode && mayContainShortcode(text) ? <EmojiText text={text} /> : text;
      return <Fragment key={key}>{applyMarks(body, node.marks, key)}</Fragment>;
    }
    case "hardBreak":
      return <br key={key} />;
    case "bulletList":
      return (
        <ul key={key} className="my-1 list-disc space-y-0.5 pl-6">
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="my-1 list-decimal space-y-0.5 pl-6">
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="my-1.5 border-l-2 border-accent-rule pl-3 text-fg-600">
          {children}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          className="my-2 overflow-x-auto rounded-lg border border-border bg-bg-code px-[13px] py-[11px] font-mono text-[12.5px] leading-[1.6] text-body"
        >
          <code>{children}</code>
        </pre>
      );
    case "mention": {
      const id = typeof node.attrs?.id === "string" ? node.attrs.id : "";
      const label = typeof node.attrs?.label === "string" ? node.attrs.label : id;
      const special = id === "channel" || id === "here";
      if (!special) return <MentionChip key={key} id={id} label={label} />;
      return (
        <span
          key={key}
          data-mention-id={id}
          className="rounded-[5px] border border-accent-surface-border bg-accent-surface px-1 py-px font-semibold text-accent-foreground"
        >
          @{label}
        </span>
      );
    }
    case "emoji": {
      const emoji = node.attrs?.emoji;
      const name = node.attrs?.name;
      return (
        <Fragment key={key}>
          {typeof emoji === "string" ? emoji : typeof name === "string" ? `:${name}:` : ""}
        </Fragment>
      );
    }
    default:
      // Unknown node types render their children rather than disappearing.
      return <Fragment key={key}>{children}</Fragment>;
  }
}

export function renderContent(doc: JSONContent | null | undefined): ReactNode {
  if (!doc || typeof doc !== "object") return null;
  return renderNode(doc, "n");
}
