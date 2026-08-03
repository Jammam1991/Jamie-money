"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui";
import { setPageHidden } from "@/lib/actions";
import { PAGES, WHERE_LABELS, type AppPage, type PageKey } from "@/lib/pages";

// One row per page, with a switch. On = Jamie sees it, off = it's gone from his
// tabs and menu, and typing the address sends him back home.
export default function SettingsClient({
  initialHidden,
}: {
  initialHidden: string[];
}) {
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: PageKey) => {
    const nowHidden = !hidden.includes(key);
    // Flip the switch straight away, put it back if the save fails.
    const before = hidden;
    setHidden(nowHidden ? [...hidden, key] : hidden.filter((k) => k !== key));
    setError(null);
    startTransition(async () => {
      const res = await setPageHidden(key, nowHidden);
      if (!res.ok) {
        setHidden(before);
        setError(res.error ?? "Couldn't save that.");
      }
    });
  };

  const groups: AppPage["where"][] = ["nav", "home", "menu"];
  const shownCount = PAGES.length - hidden.length;

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-[14px] text-muted">
        Turn a page off and it disappears for Jamie — no tab, no menu row, and
        the address stops working for him. You always see everything. Use{" "}
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
                const off = hidden.includes(page.key);
                return (
                  <div
                    key={page.key}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[15px] font-medium">
                        {off ? (
                          <EyeOff size={16} className="shrink-0 text-muted" />
                        ) : (
                          <Eye size={16} className="shrink-0 text-muted" />
                        )}
                        <span className={off ? "text-muted line-through" : ""}>
                          {page.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted">{page.blurb}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      aria-label={`Show ${page.label} to Jamie`}
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
        Jamie can see {shownCount} of {PAGES.length} pages. Home is always on.
      </p>
    </div>
  );
}
