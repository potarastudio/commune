/**
 * The login page's signature: Commune rendering its own kind of conversation,
 * in the real message style, with the studio's own voice. Static by design.
 */
const lines = [
  { name: "Hakim", handle: "hakim", time: "09:12", text: "Welcome to Commune. This is where we talk now. Slack is on notice.", reactions: ["🎉 3", "👀 2"] },
  { name: "Nadia", handle: "nadia", time: "09:14", text: "Uploaded v3 of the Bluebird homepage. Hero is tighter, CTA moved above the fold.", replies: 4 },
  { name: "Raka", handle: "raka", time: "09:15", text: "Someone brought martabak. Kitchen. Go now.", reactions: ["🔥 5"] },
] as const;

const initials: Record<string, string> = { hakim: "H", nadia: "N", raka: "R" };
const tones: Record<string, string> = {
  hakim: "bg-[#c9a96b] text-[#2a2100]",
  nadia: "bg-[#8fb8ad] text-[#0f2a24]",
  raka: "bg-[#d9927a] text-[#2f1208]",
};

export function LoginPreview() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-end gap-5 select-none">
      <div className="flex items-center gap-2 text-sidebar-muted">
        <span className="text-[13px] font-semibold text-sidebar-foreground"># general</span>
        <span className="text-[12px]">· Company-wide announcements and chatter</span>
      </div>
      <ol className="space-y-4">
        {lines.map((m) => (
          <li key={m.handle} className="flex gap-3">
            <span
              className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md text-[13px] font-semibold ${tones[m.handle]}`}
            >
              {initials[m.handle]}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold text-sidebar-foreground">{m.name}</span>
                <span className="text-[11px] tabular-nums text-sidebar-muted">{m.time}</span>
              </div>
              <p className="text-[13px] leading-[1.5] text-sidebar-foreground/90">{m.text}</p>
              {"reactions" in m && (
                <div className="mt-1.5 flex gap-1.5">
                  {m.reactions.map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-sidebar-border bg-white/5 px-2 py-0.5 text-[11px] text-sidebar-foreground/90"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {"replies" in m && (
                <p className="mt-1.5 text-[12px] font-medium text-primary">{m.replies} replies</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-white/[0.04] px-3 py-2.5 text-[13px] text-sidebar-muted">
        <span className="size-2 rounded-full bg-online" />
        Nadia is typing…
      </div>
    </div>
  );
}
