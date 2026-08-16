"use client";

import { useState, useTransition } from "react";
import { Clock, EyeOff } from "lucide-react";
import { Card } from "@/components/ui";
import { setPageForJamie, setPageSlots, type JamiePageState } from "@/lib/actions";
import {
  MAX_NAV_TABS,
  PAGES,
  SLOTS,
  SLOT_LABELS,
  pageByKey,
  type AppPage,
  type Slot,
} from "@/lib/pages";
import {
  isReachable,
  orderForSlot,
  slotsFor,
  type Placements,
} from "@/lib/navLayout";

// One row per page, with two separate controls:
//
//   Shows in    — which of the bottom bar, the menu and the History group the
//                 link sits in. That's the shape of the app, so it's the same
//                 for both of us: move a page here and it moves for you too.
//   Jamie sees  — real page, a "Coming Soon" placeholder with the link left
//                 alone, or gone from his bar and menu altogether. You always
//                 keep every link and every real page.
export default function SettingsClient({
  initialComingSoon,
  initialRemoved,
  initialPlacements,
}: {
  initialComingSoon: string[];
  initialRemoved: string[];
  initialPlacements: Placements;
}) {
  const [placements, setPlacements] = useState<Placements>(initialPlacements);
  const [comingSoon, setComingSoon] = useState<string[]>(initialComingSoon);
  const [removed, setRemoved] = useState<string[]>(initialRemoved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The bar exactly as it will render, so the summary can't disagree with it.
  const navPages = orderForSlot(
    PAGES.filter((p) => slotsFor(p, placements).includes("nav")).map((p) => p.key),
    "nav"
  )
    .map(pageByKey)
    .filter((p) => p !== undefined);
  const barIsFull = navPages.length >= MAX_NAV_TABS;

  const stateOf = (page: AppPage): JamiePageState =>
    removed.includes(page.key)
      ? "hidden"
      : comingSoon.includes(page.key)
        ? "coming-soon"
        : "real";

  function toggleSlot(page: AppPage, slot: Slot) {
    const current = slotsFor(page, placements);
    const on = current.includes(slot);
    const next = on ? current.filter((s) => s !== slot) : [...current, slot];

    // Both of these are refused by the server too. Catching them here means the
    // switch never flicks on and back off again — it just says why.
    if (!isReachable(page, next)) {
      setError(
        `${page.label} has to show somewhere. Tick another spot first, or hide it from Jamie instead.`
      );
      return;
    }
    if (!on && slot === "nav" && barIsFull) {
      setError(`The bottom bar holds ${MAX_NAV_TABS} tabs. Take one off first.`);
      return;
    }

    const before = placements;
    setPlacements({ ...placements, [page.key]: next });
    setError(null);
    startTransition(async () => {
      const res = await setPageSlots(page.key, next);
      if (!res.ok) {
        setPlacements(before);
        setError(res.error ?? "Couldn't save that.");
      }
    });
  }

  function setJamie(page: AppPage, state: JamiePageState) {
    const beforeSoon = comingSoon;
    const beforeRemoved = removed;
    setComingSoon(
      state === "coming-soon"
        ? [...comingSoon.filter((k) => k !== page.key), page.key]
        : comingSoon.filter((k) => k !== page.key)
    );
    setRemoved(
      state === "hidden"
        ? [...removed.filter((k) => k !== page.key), page.key]
        : removed.filter((k) => k !== page.key)
    );
    setError(null);
    startTransition(async () => {
      const res = await setPageForJamie(page.key, state);
      if (!res.ok) {
        setComingSoon(beforeSoon);
        setRemoved(beforeRemoved);
        setError(res.error ?? "Couldn't save that.");
      }
    });
  }

  const jamieChoices: { value: JamiePageState; label: string }[] = [
    { value: "real", label: "Real page" },
    { value: "coming-soon", label: "Coming Soon" },
    { value: "hidden", label: "Hidden" },
  ];

  const parkedCount = comingSoon.length;
  const hiddenCount = removed.length;

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-[14px] text-muted">
        <span className="font-medium">Shows in</span> is where a page&apos;s link
        sits — the bottom bar, the menu, or the History group inside the menu. A
        page can be in more than one. That&apos;s the shape of the app, so it
        changes for you as well.{" "}
        <span className="font-medium">Jamie sees</span> is his alone:{" "}
        <span className="font-medium">Coming Soon</span> leaves the link where it
        is and puts a placeholder in place of the page, and{" "}
        <span className="font-medium">Hidden</span> takes the link off his bar and
        menu completely. You always keep every link and every real page — use{" "}
        <span className="font-medium">View as Jamie</span> up top to check his
        version.
      </p>

      <Card className="p-4">
        <div className="text-[13px] font-medium text-muted">
          Bottom bar — {navPages.length} of {MAX_NAV_TABS} tabs
        </div>
        <div className="mt-1 text-[15px]">
          {navPages.map((p) => p.label).join(" · ")}
        </div>
        {barIsFull && (
          <p className="mt-2 text-[13px] text-muted">
            Full. Take a tab off before adding another.
          </p>
        )}
      </Card>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <Card className="divide-y divide-border p-0">
        {PAGES.map((page) => {
          const slots = slotsFor(page, placements);
          const state = stateOf(page);
          return (
            <div key={page.key} className="space-y-3 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                  {page.label}
                  {state === "coming-soon" && (
                    <span className="flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[11px] font-normal text-muted">
                      <Clock size={11} />
                      Coming Soon
                    </span>
                  )}
                  {state === "hidden" && (
                    <span className="flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-[11px] font-normal text-muted">
                      <EyeOff size={11} />
                      Hidden from Jamie
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">{page.blurb}</p>
              </div>

              {page.fixed ? (
                <p className="text-[13px] text-muted">
                  Always the first tab on the bottom bar, and always the real
                  page — it&apos;s the way back to the home screen.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-muted">Shows in</span>
                    {page.homeCard && (
                      <span className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted">
                        Home screen card
                      </span>
                    )}
                    {SLOTS.map((slot) => {
                      const on = slots.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`Show ${page.label} in the ${SLOT_LABELS[slot]}`}
                          disabled={pending}
                          onClick={() => toggleSlot(page, slot)}
                          className="rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50"
                          style={{
                            borderColor: on ? "var(--good)" : "var(--border)",
                            background: on ? "var(--good)" : "transparent",
                            color: on ? "#fff" : "var(--muted)",
                          }}
                        >
                          {on ? "✓ " : "+ "}
                          {SLOT_LABELS[slot]}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    role="radiogroup"
                    aria-label={`What Jamie sees on ${page.label}`}
                    className="flex items-center gap-2"
                  >
                    <span className="text-[12px] text-muted">Jamie sees</span>
                    <div className="flex flex-1 rounded-lg border border-border p-0.5">
                      {jamieChoices.map((choice) => {
                        const on = state === choice.value;
                        return (
                          <button
                            key={choice.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={pending}
                            onClick={() => setJamie(page, choice.value)}
                            className="flex-1 rounded-md px-2 py-1.5 text-[12px] transition-colors disabled:opacity-50"
                            style={{
                              background: on ? "var(--tint)" : "transparent",
                              color: on ? "var(--text)" : "var(--muted)",
                              fontWeight: on ? 500 : 400,
                            }}
                          >
                            {choice.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </Card>

      <p className="text-center text-[13px] text-muted">
        {parkedCount === 0 && hiddenCount === 0
          ? "Jamie sees every page for real."
          : [
              parkedCount > 0 && `${parkedCount} say Coming Soon`,
              hiddenCount > 0 && `${hiddenCount} hidden`,
            ]
              .filter(Boolean)
              .join(", ") + ` — out of ${PAGES.length} pages.`}
      </p>
    </div>
  );
}
