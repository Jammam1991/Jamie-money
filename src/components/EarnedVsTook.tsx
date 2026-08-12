"use client";

import { useState } from "react";
import { ChevronDown, Landmark, Scale } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import type { PayMonth } from "@/lib/gymPay";
import type { DebtTransaction } from "@/lib/store";

// ── Earned, took, and the difference ─────────────────────────────────────────
// Three numbers a month, in that order, because that's the order the question
// gets asked in: what was the job worth, what came out, who covered the rest.
//
// The private loans for the same month sit underneath, since they're the other
// half of what he owes and splitting them across two screens makes the total
// something you have to work out yourself.

function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

// "Mar 14" from an ISO timestamp. The gym dashboard sends these in UTC, so the
// date is read off the string rather than through the browser's timezone —
// otherwise a late-evening session slides to the wrong day.
function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function EarnedVsTook({
  months,
  loans,
  problem,
  admin,
}: {
  months: PayMonth[];
  loans: DebtTransaction[];
  // Why there's nothing to show, when there's nothing to show.
  problem: string | null;
  admin: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [openLine, setOpenLine] = useState<string | null>(null);

  if (months.length === 0) {
    // Jamie sees nothing at all — a half-built section is worse than no
    // section. Chris gets the reason, since he's the one who can fix it.
    if (!admin || !problem) return null;
    return (
      <Card>
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <Scale size={15} />
          What you earned vs what you took
        </p>
        <p className="mt-2 text-[13px] text-warn">{problem}</p>
        <p className="mt-1 text-xs text-muted">
          Only you can see this note — the section stays hidden for Jamie until
          it has numbers.
        </p>
      </Card>
    );
  }

  // Private loans bucketed by month, to show beside that month's pay.
  const loansByMonth = new Map<string, DebtTransaction[]>();
  for (const l of loans) {
    const key = monthKey(l.txDate);
    loansByMonth.set(key, [...(loansByMonth.get(key) ?? []), l]);
  }

  // What every month's gap adds up to. This is the headline: one month being
  // over is a rounding error, twenty months of it is the actual story.
  const totalGap = months.reduce((sum, m) => sum + m.difference, 0);

  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <Scale size={15} />
        What you earned vs what you took
      </p>

      <div
        className="mt-3 rounded-xl p-3"
        style={{
          background: totalGap > 0 ? "var(--warn-bg)" : "var(--good-bg)",
          color: totalGap > 0 ? "var(--warn)" : "var(--good)",
        }}
      >
        <p className="text-[13px]">
          {totalGap > 0 ? "Taken above what you earned" : "Taken below what you earned"}
        </p>
        <p className="text-2xl font-medium">{money(Math.abs(totalGap))}</p>
        <p className="mt-1 text-[13px]">
          {totalGap > 0
            ? "Chris put in the difference to cover it."
            : "You took less out than the work was worth."}
        </p>
      </div>

      <p className="mt-3 text-xs text-muted">
        What you earned comes from the gym dashboard — training, classes, showed
        leads, commission, your hours managing, and your share of the profit.
        Tap a month to see how it was worked out.
      </p>

      <div className="mt-3 space-y-2">
        {months.map((m) => {
          const isOpen = open === m.month;
          const monthLoans = loansByMonth.get(monthKey(m.month)) ?? [];
          const loanTotal = monthLoans.reduce((sum, l) => sum + l.amount, 0);
          const over = m.difference > 0;
          return (
            <div key={m.month} className="rounded-xl bg-tint p-3">
              <button
                className="w-full text-left"
                onClick={() => setOpen(isOpen ? null : m.month)}
                aria-expanded={isOpen}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[15px] font-medium">
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform ${isOpen ? "rotate-180" : "-rotate-90"}`}
                    />
                    {m.label}
                    {m.isCurrentMonth && (
                      <span className="text-[13px] font-normal text-muted">so far</span>
                    )}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-[14px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">You earned</span>
                    <span>{money(m.earned)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">You took</span>
                    <span>{money(m.took)}</span>
                  </div>
                  <div
                    className="flex items-center justify-between border-t pt-1 font-medium"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span>{over ? "Difference owed" : "Under what you earned"}</span>
                    <span style={{ color: over ? "var(--warn)" : "var(--good)" }}>
                      {money(Math.abs(m.difference))}
                    </span>
                  </div>
                  {loanTotal !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Private loans this month</span>
                      <span>{money(loanTotal)}</span>
                    </div>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className="text-xs font-medium">How the earnings add up</p>
                    <ul className="mt-1 space-y-1 text-xs text-muted">
                      {(
                        [
                          ["Personal training", m.earnedParts.pt, m.earnedDetails?.pt],
                          ["Classes", m.earnedParts.classes, m.earnedDetails?.classes],
                          [
                            "Leads that showed",
                            m.earnedParts.showedLeads,
                            m.earnedDetails?.showedLeads,
                          ],
                          [
                            "Commission",
                            m.earnedParts.commission,
                            m.earnedDetails?.commission,
                          ],
                          [
                            "Managing the gym",
                            m.earnedParts.management,
                            m.earnedDetails?.management,
                          ],
                          // Profit share is a formula on the month's profit,
                          // not a list of things that happened, so there's
                          // nothing to open.
                          ["Share of profit", m.earnedParts.profitShare, undefined],
                        ] as const
                      )
                        .filter(([, amount]) => amount !== 0)
                        .map(([label, amount, lines]) => {
                          const key = `${m.month}:${label}`;
                          const canOpen = Boolean(lines && lines.length > 0);
                          const lineOpen = openLine === key;
                          return (
                            <li key={label}>
                              <button
                                className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-default"
                                onClick={() => setOpenLine(lineOpen ? null : key)}
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
                                  {canOpen && (
                                    <span className="text-faint">({lines!.length})</span>
                                  )}
                                </span>
                                <span>{money(amount)}</span>
                              </button>

                              {lineOpen && lines && (
                                <ul className="mt-1 space-y-1 border-l pl-3" style={{ borderColor: "var(--border)" }}>
                                  {lines.map((l, i) => (
                                    <li
                                      key={`${l.date ?? ""}-${l.label}-${i}`}
                                      className="flex items-start justify-between gap-2"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate">{l.label}</span>
                                        <span className="block text-faint">
                                          {[shortDate(l.date), l.meta]
                                            .filter(Boolean)
                                            .join(" · ")}
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

                  {m.tookFrom.length > 0 && (
                    <div>
                      <p className="text-xs font-medium">Where what you took came from</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted">
                        {m.tookFrom.map((a) => (
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

                  {monthLoans.length > 0 && (
                    <div>
                      <p className="text-xs font-medium">Private loans from Chris</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted">
                        {monthLoans.map((l) => (
                          <li key={l.id} className="flex justify-between gap-2">
                            <span className="truncate">
                              {l.description} · {l.txDate}
                            </span>
                            <span className="shrink-0">{money(l.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
