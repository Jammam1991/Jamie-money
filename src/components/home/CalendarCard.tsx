"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Link2, MapPin, Unplug } from "lucide-react";
import { saveCalendarLink } from "@/lib/actions";
import type { CalEvent, CalendarResult } from "@/lib/calendar";

const TZ = "America/Los_Angeles";

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

function dayHeading(key: string): string {
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

function Head({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#0e6f8a18", color: "#0e6f8a" }}>
        <CalendarDays size={18} />
      </span>
      <span className="flex-1 text-[16px] font-semibold">Calendar</span>
      {children}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <Head />
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-2xl bg-tint" />
        ))}
      </div>
    </section>
  );
}

export default function CalendarCard({ result }: { result: CalendarResult }) {
  const [connecting, setConnecting] = useState(false);
  const connected = result.state !== "none";

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <Head>
        {connected && !connecting && (
          <button
            type="button"
            onClick={() => setConnecting(true)}
            className="text-[12px] text-muted underline-offset-2 hover:underline"
          >
            Change
          </button>
        )}
      </Head>

      {connecting || !connected ? (
        <ConnectForm connected={connected} onDone={() => setConnecting(false)} />
      ) : result.state === "error" ? (
        <p className="mt-4 rounded-2xl bg-warn-bg px-4 py-3 text-[14px] text-warn">{result.message}</p>
      ) : (
        <Events events={result.events} />
      )}
    </section>
  );
}

function Events({ events }: { events: CalEvent[] }) {
  if (events.length === 0) {
    return <p className="mt-4 text-center text-[14px] text-muted">Nothing on the calendar for the next two weeks. 🌴</p>;
  }
  // Grouped by day, at most the next four days that have something on.
  const days = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = dayKey(e.start) < dayKey(new Date().toISOString()) ? dayKey(new Date().toISOString()) : dayKey(e.start);
    if (!days.has(k) && days.size >= 4) break;
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  return (
    <div className="mt-4 space-y-3">
      {[...days.entries()].map(([k, list]) => (
        <div key={k}>
          <div className="text-[12px] font-medium uppercase tracking-wider text-muted">{dayHeading(k)}</div>
          <ul className="mt-1 space-y-1.5">
            {list.map((e) => (
              <li key={e.id} className="flex gap-3 rounded-2xl bg-tint px-3 py-2.5">
                <span className="w-1 shrink-0 rounded-full" style={{ background: "#0e6f8a" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{e.title}</span>
                  {e.location && (
                    <span className="flex items-center gap-1 truncate text-[12px] text-muted">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{e.location}</span>
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-[12px] tabular-nums text-muted">
                  {e.allDay ? "All day" : timeOf(e.start)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// One paste and it's connected. Google gives every calendar a private link for
// exactly this; the steps below are the whole trip to find it.
function ConnectForm({ connected, onDone }: { connected: boolean; onDone: () => void }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(value: string) {
    setError(null);
    startTransition(async () => {
      const res = await saveCalendarLink(value);
      if (!res.ok) {
        setError(res.error ?? "Not saved. Try again.");
        return;
      }
      setLink("");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-3">
      {!connected && (
        <p className="text-[14px]">See your Google Calendar right here. It takes one minute, once:</p>
      )}
      <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-muted">
        <li>
          On a computer, open{" "}
          <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noreferrer" className="font-medium text-text underline underline-offset-2">
            Google Calendar settings
          </a>
          .
        </li>
        <li>On the left, under &ldquo;Settings for my calendars&rdquo;, click your calendar.</li>
        <li>
          Scroll to <span className="font-medium text-text">Secret address in iCal format</span> and copy it.
        </li>
        <li>Paste it below.</li>
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(link);
        }}
        className="flex gap-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-bg px-3 focus-within:border-[var(--muted)]">
          <Link2 size={15} className="shrink-0 text-muted" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] outline-none"
            aria-label="Calendar link"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          disabled={pending || !link.trim()}
          className="shrink-0 rounded-2xl px-4 text-[14px] font-medium text-white disabled:opacity-40"
          style={{ background: "#0e6f8a" }}
        >
          {pending ? "Checking…" : "Connect"}
        </button>
      </form>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      {connected && (
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onDone} className="text-[13px] text-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save("")}
            disabled={pending}
            className="flex items-center gap-1 text-[13px] text-neg disabled:opacity-40"
          >
            <Unplug size={13} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
