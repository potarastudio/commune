import type { MessageAuthor } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";

/*
 * Small pieces the phone screens share. No hooks here, so server-rendered
 * screens can use them as they are.
 */

/** A round face: the photo, or the first letter on the avatar tint. */
export function RoundFace({ person, size }: { person: Pick<MessageAuthor, "display_name" | "avatar_url"> | null; size: number }) {
  const name = person?.display_name ?? "Someone";
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]"
      style={{ width: size, height: size }}
    >
      {person?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars come from storage and Google, sized by CSS
        <img src={person.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[13px] font-semibold text-fg-600">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

/** The design's 44px accent button: 12px radius, a hairline highlight on top. */
export function primaryButtonClass(className?: string) {
  return cn(
    "flex h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-[12px] border border-accent-border bg-primary px-[18px] text-[14px] font-semibold text-white shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.2)] active:bg-primary-hover disabled:opacity-60 [&>svg]:size-[16px]",
    className,
  );
}

/** The design's 44px outline button on the card surface. */
export function secondaryButtonClass(className?: string) {
  return cn(
    "flex h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-[12px] border border-border-strong bg-bg-card px-[16px] text-[14px] font-semibold text-ink shadow-[0_1px_2px_0_var(--shadow-tint-sm)] active:bg-bg-subtle disabled:opacity-60 [&>svg]:size-[16px]",
    className,
  );
}

/**
 * A designed empty state (design: Mobile System States → Empty): a 56px tile,
 * the title at 19px, one line of why, and the one action worth taking, sized
 * as a real button rather than a line of grey text.
 */
export function MobileEmpty({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-full flex-1 flex-col items-center justify-center px-[28px] py-[24px] text-center", className)}>
      <span className="grid size-[56px] shrink-0 place-items-center rounded-[16px] border border-border bg-bg-chip text-[22px] font-semibold text-tertiary [&>svg]:size-[22px] [&>svg]:text-fg-600">
        {icon}
      </span>
      <h2 className="mt-[16px] text-[19px] font-semibold tracking-[-0.02em] text-ink [text-wrap:pretty]">{title}</h2>
      <p className="mt-[8px] max-w-[280px] text-[14px] leading-[1.6] text-fg-600 [text-wrap:pretty]">{body}</p>
      {action && <div className="mt-[18px]">{action}</div>}
    </div>
  );
}
