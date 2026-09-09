import type { Metadata } from "next";
import { Archive, Check, ChevronDown, Hash, Lock, Plus, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateChannelPopover } from "@/components/channel/create-channel-popover";
import { JoinLeaveButton } from "@/components/channel/join-leave-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getChannelsForBrowse, type BrowseChannel } from "@/lib/queries/channel";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Browse channels" };

/**
 * The bar's sort control. The design labels it "Most active", but nothing in the
 * browse query knows when a channel last spoke — only its size — so the two
 * orders offered are the two we can honestly compute. A–Z stays the default,
 * which is the order this page has always shipped.
 */
type Sort = "name" | "members";
const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Name (A–Z)" },
  { id: "members", label: "Most members" },
];

/** Every channel you can see: public ones to join, private ones you belong to (§5). */
export default async function BrowseChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const { q: rawQuery, sort: rawSort } = await searchParams;
  const query = (rawQuery ?? "").trim();
  const sort: Sort = rawSort === "members" ? "members" : "name";

  const channels = await getChannelsForBrowse(supabase, profile.id);

  // The list is small and already loaded, so the field filters it here rather
  // than going back to Postgres for a search we don't need.
  const needle = query.toLowerCase();
  const matches = (c: BrowseChannel) =>
    needle === "" ||
    c.name.toLowerCase().includes(needle) ||
    (c.topic ?? "").toLowerCase().includes(needle) ||
    (c.description ?? "").toLowerCase().includes(needle);
  const order = (rows: BrowseChannel[]) =>
    sort === "members"
      ? [...rows].sort((a, b) => b.member_count - a.member_count || a.name.localeCompare(b.name))
      : [...rows].sort((a, b) => a.name.localeCompare(b.name));

  const allLive = channels.filter((c) => !c.is_archived);
  const found = channels.filter(matches);
  const live = found.filter((c) => !c.is_archived);
  const joined = order(live.filter((c) => c.joined));
  const others = order(live.filter((c) => !c.joined));
  const archived = order(found.filter((c) => c.is_archived));

  const sortHref = (id: Sort) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (id !== "name") params.set("sort", id);
    const qs = params.toString();
    return qs ? `/channels?${qs}` : "/channels";
  };

  const Row = ({ c }: { c: (typeof channels)[number] }) => {
    const Icon = c.is_archived ? Archive : c.is_private ? Lock : Hash;
    return (
      <li className="flex items-center gap-[13px] border-b border-border-subtle px-5 py-[13px] transition-colors hover:bg-bg-hover">
        <span
          className={`grid size-[38px] shrink-0 place-items-center rounded-[10px] border border-border-subtle ${
            c.is_archived ? "bg-bg-subtle text-tertiary" : "bg-bg-chip text-fg-600"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-2 text-[14px] font-semibold text-ink">
            <Link href={`/channel/${c.id}`} className="hover:underline">
              {c.name}
            </Link>
            <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
              {c.member_count} {c.member_count === 1 ? "member" : "members"}
              {c.is_private ? " · private" : ""}
              {c.is_archived ? " · archived" : ""}
            </span>
          </p>
          {(c.description || c.topic) && (
            <p className="mt-[3px] truncate text-[13px] text-fg-600">{c.description || c.topic}</p>
          )}
        </div>
        {c.is_archived ? (
          <span className="flex h-8 shrink-0 items-center rounded-md border border-border bg-bg-chip px-[11px] text-[12.5px] font-semibold text-fg-600">
            Read only
          </span>
        ) : c.joined ? (
          <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg-chip px-[11px] text-[12.5px] font-semibold text-fg-600">
            <Check className="size-[13px]" aria-hidden="true" />
            Joined
          </span>
        ) : (
          <JoinLeaveButton channelId={c.id} channelName={c.name} joined={false} />
        )}
      </li>
    );
  };

  const Overline = ({ children }: { children: React.ReactNode }) => (
    <h2 className="sticky top-0 z-[2] border-b border-border-subtle bg-bg-main px-5 py-[9px] text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
      {children}
    </h2>
  );

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Browse channels</h1>
        <span className="text-[12.5px] text-muted-foreground">
          {query
            ? `${live.length} of ${allLive.length} ${allLive.length === 1 ? "channel" : "channels"}`
            : `${allLive.length} ${allLive.length === 1 ? "channel" : "channels"}`}
        </span>
        <div className="ml-auto">
          <CreateChannelPopover>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-[7px] px-[11px] has-[>svg]:px-[11px]">
              <Plus className="size-[14px] text-fg-600" aria-hidden="true" />
              Create
            </Button>
          </CreateChannelPopover>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
            <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
              <Hash className="size-[17px]" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No channels yet</h2>
            <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
              Channels are where the studio talks about a topic, project or client. Start the first one.
            </p>
          </div>
        ) : (
          <>
            {/* Search + sort, the first thing in the scroll area as the design draws it. */}
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-3">
              <Form
                action="/channels"
                role="search"
                className="field-focus flex h-[34px] min-w-0 max-w-[360px] flex-1 items-center gap-[9px] rounded-md border border-border-strong bg-bg-chip px-2.5 transition-colors"
              >
                <Search className="size-[14px] shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search channels"
                  aria-label="Search channels"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-body outline-none placeholder:text-muted-foreground"
                />
                {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
              </Form>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Sort channels: ${SORTS.find((s) => s.id === sort)?.label}`}
                  className="ml-auto flex h-[34px] shrink-0 items-center gap-1.5 rounded-md px-[9px] text-[12.5px] font-semibold text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
                >
                  {SORTS.find((s) => s.id === sort)?.label}
                  <ChevronDown className="size-[13px]" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  {SORTS.map((s) => (
                    <DropdownMenuItem key={s.id} asChild>
                      <Link href={sortHref(s.id)}>
                        <Check className={`size-[15px] ${s.id === sort ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                        {s.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {query && live.length === 0 && archived.length === 0 && (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
                <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
                  <Search className="size-[17px]" aria-hidden="true" />
                </span>
                <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No channels match “{query}”</h2>
                <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
                  Try a shorter word, or{" "}
                  <Link href="/channels" className="link-ink">
                    clear the search
                  </Link>
                  .
                </p>
              </div>
            )}

            {others.length > 0 && (
              <section>
                <Overline>You can join</Overline>
                <ul>
                  {others.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </ul>
              </section>
            )}

            {(joined.length > 0 || !query) && (
              <section>
                <Overline>Your channels</Overline>
                <ul>
                  {joined.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </ul>
                {!query && others.length === 0 && (
                  <p className="border-b border-border-subtle px-5 py-[13px] text-[13px] leading-[1.55] text-fg-600">
                    You&rsquo;re in every channel there is. Start a new one for a project or a client.
                  </p>
                )}
              </section>
            )}

            {archived.length > 0 && (
              <section>
                <Overline>Archived</Overline>
                <p className="border-b border-border-subtle px-5 py-[11px] text-[13px] leading-[1.55] text-fg-600">
                  Still readable and searchable. Admins can bring one back from inside the channel.
                </p>
                <ul>
                  {archived.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
