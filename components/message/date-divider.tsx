export function DateDivider({ label, tone = "default" }: { label: string; tone?: "default" | "new" }) {
  const isNew = tone === "new";
  return (
    <div className="relative my-3 flex items-center px-5" role="separator" aria-label={label}>
      <span className={`h-px flex-1 ${isNew ? "bg-destructive/50" : "bg-divider"}`} />
      <span
        className={
          isNew
            ? "px-3 text-[12px] font-medium text-destructive"
            : "rounded-full border border-border bg-background px-3 py-0.5 text-[12px] font-medium text-foreground/80 shadow-xs"
        }
      >
        {label}
      </span>
      <span className={`h-px flex-1 ${isNew ? "bg-destructive/50" : "bg-divider"}`} />
    </div>
  );
}
