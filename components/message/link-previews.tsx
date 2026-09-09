"use client";

import { useLinkPreview } from "@/lib/queries/link-previews";
import { Skeleton } from "@/components/ui/skeleton";

function PreviewCard({ url }: { url: string }) {
  const { data, isPending } = useLinkPreview(url);

  if (isPending) {
    return (
      <div className="flex w-full max-w-[480px] gap-3 rounded-lg border border-border border-l-4 border-l-border p-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }
  if (!data?.ok || !data.title) return null;

  let host = data.site_name ?? "";
  try {
    host ||= new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep */
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/card flex w-full max-w-[480px] gap-3 rounded-lg border border-border border-l-4 border-l-primary/60 bg-background p-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-muted-foreground">{host}</p>
        <p className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug text-link group-hover/card:underline">{data.title}</p>
        {data.description && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{data.description}</p>}
      </div>
      {data.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image_url}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-md object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </a>
  );
}

/** Cards for the first links in a message (§5 Phase 2). Missing or failed previews render nothing. */
export function LinkPreviews({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {urls.map((u) => (
        <PreviewCard key={u} url={u} />
      ))}
    </div>
  );
}
