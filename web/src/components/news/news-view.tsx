"use client";

import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Card, Chip, EmptyState, IconButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { parseHandle, SUGGESTED, useXAccounts, type XAccount } from "./x-accounts";
import { XTimeline } from "./x-timeline";

const ALL = "__all";

export function NewsFeed() {
  const { accounts, remove } = useXAccounts();
  const [selected, setSelected] = useState(ALL);
  const shown = selected === ALL ? accounts : accounts.filter((a) => a.handle === selected);

  if (!accounts.length)
    return <EmptyState title="You're not following any X accounts" hint="Add reporters, clubs or leagues in the Accounts panel." />;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Chip active={selected === ALL} onClick={() => setSelected(ALL)}>
          All
        </Chip>
        {accounts.map((a) => (
          <Chip key={a.handle} active={selected === a.handle} onClick={() => setSelected(a.handle)}>
            {a.label ?? `@${a.handle}`}
          </Chip>
        ))}
      </div>

      <div className={cn("grid gap-4", shown.length > 1 && "lg:grid-cols-2")}>
        {shown.map((a) => (
          <Card
            key={a.handle}
            title={
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate">@{a.handle}</span>
                {a.label && <span className="truncate text-xs font-normal text-muted">{a.label}</span>}
              </span>
            }
            action={
              <div className="flex gap-1.5">
                <a
                  href={`https://x.com/${a.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open @${a.handle} on X`}
                  title="Open on X"
                  className="grid size-9 place-items-center rounded-[10px] bg-surface-2 text-muted transition-colors hover:text-text"
                >
                  <ExternalLink className="size-4" />
                </a>
                <IconButton
                  label={`Stop following @${a.handle}`}
                  onClick={() => {
                    remove(a.handle);
                    if (selected === a.handle) setSelected(ALL);
                  }}
                >
                  <X className="size-4" />
                </IconButton>
              </div>
            }
          >
            <div className="max-h-[640px] overflow-y-auto">
              <XTimeline handle={a.handle} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export function AccountsPanel() {
  const { accounts, add, remove, has } = useXAccounts();
  const toast = useToast();
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const follow = (a: XAccount) => {
    if (add(a)) toast(`Following @${a.handle}`);
    else toast(`Already following @${a.handle}`, "info");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseHandle(handle);
    if (!parsed) return setError("Enter an X handle like @FabrizioRomano or an x.com link");
    if (has(parsed)) return setError(`You already follow @${parsed}`);
    follow({ handle: parsed, label });
    setHandle("");
    setLabel("");
    setError(null);
  };

  const suggestions = SUGGESTED.filter((s) => !has(s.handle));

  return (
    <>
      <Card title="Add an X account">
        <form onSubmit={submit} className="space-y-2">
          <input
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setError(null);
            }}
            placeholder="@handle or x.com link"
            aria-label="X handle"
            aria-invalid={!!error}
            className="w-full rounded-[10px] border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-line-strong"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional), e.g. Arsenal news"
            aria-label="Label"
            maxLength={30}
            className="w-full rounded-[10px] border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-line-strong"
          />
          {error && <p className="text-xs text-negative-text">{error}</p>}
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent-fill px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-dim"
          >
            <Plus className="size-4" /> Follow
          </button>
        </form>
      </Card>

      <Card title={`Following (${accounts.length})`}>
        {accounts.length ? (
          <ul className="space-y-1">
            {accounts.map((a) => (
              <li key={a.handle} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2/60">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">@{a.handle}</div>
                  {a.label && <div className="truncate text-xs text-muted">{a.label}</div>}
                </div>
                <IconButton label={`Stop following @${a.handle}`} onClick={() => remove(a.handle)} className="size-8">
                  <X className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No accounts yet.</p>
        )}
      </Card>

      {suggestions.length > 0 && (
        <Card title="Suggested">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.handle}
                type="button"
                onClick={() => follow(s)}
                title={`Follow @${s.handle}`}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
              >
                <Plus className="size-3.5" />
                {s.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      <p className="px-1 text-xs text-faint">
        Timelines are X&apos;s free embeds, so X decides what loads. If one stays blank, log in to x.com in this browser or
        allow platform.twitter.com in your blocker.
      </p>
    </>
  );
}
