/**
 * The login page's signature: Commune rendering its own kind of conversation,
 * in the real message style, with the studio's own voice. Static by design.
 *
 * It sits on the rail, which is near-black in both themes, so the palette here
 * is white at fixed opacities — exactly as the design specifies it. The one
 * literal hex is the thread-reply orange: the rail never changes with the
 * theme, and --accent-text flips to a dark orange in light mode.
 */
const lines = [
  {
    name: "Hakim",
    handle: "hakim",
    time: "09:12",
    text: "Welcome to Commune. This is where we talk now.",
    reactions: ["🎉 3", "👀 2"],
  },
  {
    name: "Sari",
    handle: "sari",
    time: "09:14",
    text: "Uploaded v3 of the Bluebird homepage. Hero is tighter, CTA moved above the fold.",
    replies: 4,
  },
  {
    name: "Raka",
    handle: "raka",
    time: "09:15",
    text: "Someone brought martabak. Kitchen. Go now.",
    reactions: ["🔥 5"],
  },
] as const;

export function LoginPreview() {
  return (
    <div aria-hidden="true" className="flex min-w-0 select-none flex-col gap-[18px]">
      <div className="flex flex-wrap items-baseline gap-[8px]">
        <span className="text-[13px] font-semibold text-white">{"# general"}</span>
        <span className="text-[12px] text-white/45">Studio-wide announcements and chatter</span>
      </div>

      <ol className="flex flex-col gap-[16px]">
        {lines.map((m) => (
          <li key={m.handle} className="flex gap-[11px]">
            <span className="mt-px grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-white/8 text-[13px] font-semibold text-white/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              {m.name[0]}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-[8px]">
                <span className="text-[13px] font-semibold text-white">{m.name}</span>
                <time className="text-[11.5px] tabular-nums text-white/45">{m.time}</time>
              </div>
              <p className="mt-px text-[13px] leading-[1.55] text-white/82 text-pretty">{m.text}</p>
              {"reactions" in m && (
                <div className="mt-[7px] flex gap-[6px]">
                  {m.reactions.map((r) => (
                    <span
                      key={r}
                      className="flex h-[24px] items-center gap-[5px] rounded-[7px] border border-white/12 bg-white/6 px-[8px] text-[11.5px] font-medium whitespace-nowrap tabular-nums text-white/85"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {"replies" in m && (
                <p className="mt-[7px] text-[12px] font-semibold text-[#ff9a5e]">{m.replies} replies</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-[9px] rounded-[10px] border border-white/10 bg-white/4 px-[12px] py-[10px] text-[12.5px] text-white/55">
        <span className="flex items-end gap-[2.5px]">
          <span className="typing-dot block size-[4px] rounded-full bg-presence" />
          <span className="typing-dot block size-[4px] rounded-full bg-presence" />
          <span className="typing-dot block size-[4px] rounded-full bg-presence" />
        </span>
        Sari is typing…
      </div>
    </div>
  );
}
