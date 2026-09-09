"use client";

/** "Sari is typing…" under the list; fixed 22px height so the composer never jumps. */
export function TypingIndicator({ people }: { people: { id: string; name: string }[] }) {
  const names = people.map((p) => p.name.split(" ")[0]);
  let text = "";
  if (names.length === 1) text = `${names[0]} is typing…`;
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
  else if (names.length > 2) text = `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`;

  return (
    <p className="flex h-[22px] items-center gap-[7px] px-0.5 text-[12.5px] text-fg-600" aria-live="polite">
      {text && (
        <>
          <span className="flex items-end gap-[2.5px]" aria-hidden="true">
            <span className="typing-dot size-1 rounded-full bg-tertiary" />
            <span className="typing-dot size-1 rounded-full bg-tertiary [animation-delay:150ms]" />
            <span className="typing-dot size-1 rounded-full bg-tertiary [animation-delay:300ms]" />
          </span>
          {text}
        </>
      )}
    </p>
  );
}
