/**
 * Day markers in the message list. The "New messages" line uses the accent
 * (never red) so it reads as a place-marker, not an error.
 */
export function DateDivider({ label, tone = "default" }: { label: string; tone?: "default" | "new" }) {
  const isNew = tone === "new";
  return (
    <div
      className={`flex items-center px-4 pb-1 pt-3.5 md:px-6 ${isNew ? "gap-[9px]" : "gap-3"}`}
      role="separator"
      aria-label={label}
    >
      <span className={`text-[12px] font-semibold ${isNew ? "text-accent-text" : "text-fg-600"}`}>{label}</span>
      <span aria-hidden="true" className={`h-px flex-1 ${isNew ? "bg-accent-rule" : "bg-bg-avatar"}`} />
    </div>
  );
}
