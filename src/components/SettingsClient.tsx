"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui";
import { setPageComingSoon } from "@/lib/actions";
import { PAGES, WHERE_LABELS, type AppPage, type PageKey } from "@/lib/pages";

// One row per page, with a switch. On = Jamie sees the real page. Off = the
// link stays exactly where it is, but the page shows "Coming Soon" instead of
// anything real.
export default function SettingsClient({
  initialComingSoon,
}: {
  initialComingSoon: string[];
}) {
  const [parked, setParked] = useState<string[]>(initialComingSoon);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: PageKey) => {
    const nowParked = !parked.includes(key);
    // Flip the switch straight away, put it back if the save fails.
    const before = parked;
    setParked(nowParked ? [...parked, key] : parked.filter((k) => k !== key));
    setError(null);
    startTransition(async () => {
      const res = await setPageComingSoon(key, nowParked);
      if (!res.ok) {
        setParked(before);
        setError(res.error ?? "Couldn't save that.");
      }
    });
  };

  const groups: AppPage["where"][] = ["nav", "home", "menu"];
  const parkedCount = parked.length;

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-[14px] text-muted">
        Switch a page off and Jamie still sees its tab and menu row — but when he
        opens it, the whole page just says{" "}
        <span className="font-medium">Coming Soon</span>. None of the real
        numbers load. You always see the real page. Use{" "}
        <span className="font-medium">View as Jamie</span> up top to check his
        version.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {groups.map((where) => {
        const rows = PAGES.filter((p) => p.where === where);
        if (rows.length === 0) return null;
        return (
          <div key={where}>
            <h2 className="mb-2 text-[13px] font-medium text-muted">
              {WHERE_LABELS[where]}
            </h2>
            <Card className="divide-y divide-border p-0">
              {rows.map((page) => {
                const off = parked.includes(page.key);
                return (
                  <div
                    key={page.key}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                        {page.label}
                        {off && (
                          <span className="flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[11px] font-normal text-muted">
                            <Clock size={11} />
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted">{page.blurb}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      aria-label={`Show the real ${page.label} page to Jamie`}
                      disabled={pending}
                      onClick={() => toggle(page.key)}
                      className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: off ? "var(--tint)" : "var(--good)",
                      }}
                    >
                      <span
                        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                        style={{ left: off ? "0.25rem" : "1.75rem" }}
                      />
                    </button>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}

      <p className="text-center text-[13px] text-muted">
        {parkedCount === 0
          ? "Jamie sees every page for real."
          : `${parkedCount} of ${PAGES.length} pages say Coming Soon to Jamie.`}
      </p>
    </div>
  );
}
