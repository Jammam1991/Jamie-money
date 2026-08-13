"use client";

import { useState } from "react";
import { ChevronDown, Landmark } from "lucide-react";
import { money } from "@/lib/data";
import type { PayMonth } from "@/lib/gymPay";

// ── One month's business pay ─────────────────────────────────────────────────
// What the work was worth, what came out of the business, and who covered the
// gap — shown inside a month of the year list, under the loans Chris made
// personally. Two different pots, so they're named and never added together.
//
// Its own file because the year list is long enough already, and this block has
// its own open/closed state for each earnings line.

// "Mar 14" from an ISO timestamp. Read off the string rather than through the
// browser's timezone, which would slide a late-evening session onto the wrong
// day.
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

export default function BusinessPayMonth({ pay }: { pay: PayMonth }) {
  const [openLine, setOpenLine] = useState<string | null>(null);
  const over = pay.difference > 0;

  const parts = (
    [
      ["Personal training", pay.earnedParts.pt, pay.earnedDetails?.pt],
      ["Classes", pay.earnedParts.classes, pay.earnedDetails?.classes],
      ["Leads that showed", pay.earnedParts.showedLeads, pay.earnedDetails?.showedLeads],
      ["Commission", pay.earnedParts.commission, pay.earnedDetails?.commission],
      ["Managing the gym", pay.earnedParts.management, pay.earnedDetails?.management],
      // Profit share is a formula on the month's profit, not a list of things
      // that happened, so there's nothing to open.
      ["Share of profit", pay.earnedParts.profitShare, undefined],
    ] as const
  ).filter(([, amount]) => amount !== 0);

  return (
    <div className="mt-2 rounded-lg bg-card p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">Business pay</p>

      <div className="mt-1 space-y-1 text-[14px]">
        <div className="flex items-center justify-between">
          <span className="text-muted">You earned</span>
          <span>{money(pay.earned)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">You took</span>
          <span>{money(pay.took)}</span>
        </div>
        <div
          className="flex items-center justify-between border-t pt-1 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          <span>{over ? "Difference you owe" : "Under what you earned"}</span>
          <span style={{ color: over ? "var(--warn)" : "var(--good)" }}>
            {money(Math.abs(pay.difference))}
          </span>
        </div>
      </div>

      {parts.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium">How the earnings add up</p>
          <ul className="mt-1 space-y-1 text-xs text-muted">
            {parts.map(([label, amount, lines]) => {
              const canOpen = Boolean(lines && lines.length > 0);
              const lineOpen = openLine === label;
              return (
                <li key={label}>
                  <button
                    className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-default"
                    onClick={() => setOpenLine(lineOpen ? null : label)}
                    disabled={!canOpen}
                    aria-expanded={canOpen ? lineOpen : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {canOpen && (
                        <ChevronDown
                          size={11}
                          className={`shrink-0 transition-transform ${lineOpen ? "rotate-180" : "-rotate-90"}`}
                        />
                      )}
                      {label}
                      {canOpen && <span className="text-faint">({lines!.length})</span>}
                    </span>
                    <span>{money(amount)}</span>
                  </button>

                  {lineOpen && lines && (
                    <ul
                      className="mt-1 space-y-1 border-l pl-3"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {lines.map((l, i) => (
                        <li
                          key={`${l.date ?? ""}-${l.label}-${i}`}
                          className="flex items-start justify-between gap-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{l.label}</span>
                            <span className="block text-faint">
                              {[shortDate(l.date), l.meta].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0">{money(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pay.tookFrom.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium">Where what you took came from</p>
          <ul className="mt-1 space-y-1 text-xs text-muted">
            {pay.tookFrom.map((a) => (
              <li key={a.name} className="flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1">
                  <Landmark size={11} className="shrink-0" />
                  <span className="truncate">{a.name}</span>
                </span>
                <span className="shrink-0">{money(a.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
