"use client";

/** "Nadia is typing…" under the list; fixed height so the composer never jumps. */
export function TypingIndicator({ people }: { people: { id: string; name: string }[] }) {
  const names = people.map((p) => p.name.split(" ")[0]);
  let text = "";
  if (names.length === 1) text = `${names[0]} is typing…`;
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
  else if (names.length > 2) text = `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`;

  return (
    <p className="flex h-5 items-center gap-1.5 px-1 text-[12px] text-muted-foreground" aria-live="polite">
      {text && (
        <>
          <span className="flex items-end gap-0.5" aria-hidden="true">
            <span className="typing-dot size-1 rounded-full bg-muted-foreground" />
            <span className="typing-dot size-1 rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="typing-dot size-1 rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
          {text}
        </>
      )}
    </p>
  );
}
