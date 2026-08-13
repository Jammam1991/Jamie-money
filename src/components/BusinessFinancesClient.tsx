"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card, Tint } from "@/components/ui";
import type { BusinessFinances, Mistake, Rollup } from "@/lib/businessFinances";

// ── The gym's books, as Jamie sees them ──────────────────────────────────────
// Every section here is one of Chris's tick-boxes in the Money App (Settings →
// Shared access). A section that isn't ticked never arrives — so an empty list
// and a hidden list look the same from in here, and that's on purpose: this
// component draws what it was sent and doesn't try to explain the gaps.
//
// The one piece of state is the mistakes button. Both versions of the year come
// down in the same response, so switching between them is instant and doesn't
// ask Money App anything twice.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Whole dollars, with the minus in front of the sign rather than after it —
// a losing month reads "-$3,200", not "$-3,200". The shared money() helper
// puts it the other way round, and a bad month is exactly where that shows.
function money(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

// Calculate year-end profit projection for the current year only
function getYearEndProjection(profit: number, year: number): number | null {
  const today = new Date();
  const currentYear = today.getFullYear();

  // Only show projection for current year and positive profit
  if (year !== currentYear || profit <= 0) return null;

  // Calculate days into year: Jan 1 to today
  const jan1 = new Date(currentYear, 0, 1);
  const daysIntoYear = Math.ceil((today.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Annualize: profit / daysIntoYear * 365
  return (profit / daysIntoYear) * 365;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

export default function BusinessFinancesClient({ data }: { data: BusinessFinances }) {
  const [hideMistakes, setHideMistakes] = useState(false);

  const { view, noMistakes } = data;
  // The button can only be on while there's something to switch to — a year with
  // no mistakes marked still has a `noMistakes` block, just an empty one.
  const canSwitch = Boolean(noMistakes && noMistakes.mistakes.length > 0);
  const on = hideMistakes && canSwitch;
  const rollup: Rollup = on && noMistakes ? noMistakes.rollup : data.actual;

  return (
    <div className="space-y-4">
      <IntroCard data={data} />

      {view.show_headline && <Headline rollup={rollup} on={on} year={data.year} />}

      {canSwitch && noMistakes && (
        <MistakesPanel
          on={on}
          onToggle={() => setHideMistakes((v) => !v)}
          actualProfit={data.actual.netProfit}
          fixedProfit={noMistakes.rollup.netProfit}
          difference={noMistakes.profitDifference}
          mistakes={noMistakes.mistakes}
        />
      )}

      {view.show_monthly && <MonthlyStrip rollup={rollup} on={on} />}

      {view.show_schedule_c && <Lines rollup={rollup} on={on} />}

      {view.show_flagged && data.flagged.length > 0 && (
        <Card>
          <SectionTitle>Set aside to ask about</SectionTitle>
          <p className="mt-1 text-[13px] text-muted">
            Chris marked these to go over with the accountant.
          </p>
          <ul className="mt-3 space-y-2">
            {data.flagged.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px]">{t.name ?? "—"}</p>
                  <p className="text-[12px] text-muted">{shortDate(t.date)}</p>
                </div>
                <span
                  className="shrink-0 text-[14px] font-medium"
                  style={{ color: t.isIncome ? "var(--good)" : undefined }}
                >
                  {money(Math.abs(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.show_notes && data.notes.length > 0 && (
        <Card>
          <SectionTitle>Notes</SectionTitle>
          <ul className="mt-3 space-y-3">
            {data.notes.map((n) => (
              <li key={n.id}>
                <p className="text-[14px] font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>}
                {n.cpa_answer && (
                  <p className="mt-1 text-[13px]" style={{ color: "var(--good)" }}>
                    Answer: {n.cpa_answer}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.show_documents && data.documents.length > 0 && (
        <Card>
          <SectionTitle>Documents</SectionTitle>
          <ul className="mt-3 space-y-2">
            {data.documents.map((d) => (
              <li key={d.id} className="text-[14px]">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--good)" }}
                  >
                    {d.label ?? d.file_name}
                  </a>
                ) : (
                  <span className="text-muted">{d.label ?? d.file_name}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[16px] font-semibold">{children}</p>;
}

// The year, how current the books are, and — when more than one year is
// allowed — the other years to jump to.
function IntroCard({ data }: { data: BusinessFinances }) {
  return (
    <Card>
      <p className="text-[15px] font-medium">The gym&apos;s money, {data.year}</p>
      <p className="mt-1 text-[13px] text-muted">
        Straight from Chris&apos;s accounting app. He picks what shows up here.
        {data.throughDate && ` Counted up to ${shortDate(data.throughDate)}.`}
      </p>
      {data.years.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.years.map((y) => (
            <Link
              key={y}
              href={`/business-finances?year=${y}`}
              scroll={false}
              className="rounded-lg border border-border px-3 py-1 text-[13px]"
              style={
                y === data.year
                  ? { background: "var(--good)", color: "#fff", borderColor: "var(--good)" }
                  : undefined
              }
            >
              {y}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// Money in, money out, what's left. The three numbers everything else explains.
function Headline({ rollup, on, year }: { rollup: Rollup; on: boolean; year: number }) {
  const out = rollup.cogs + rollup.expenses;
  const profit = rollup.netProfit;
  const projection = getYearEndProjection(profit, year);

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <SectionTitle>{profit >= 0 ? "Made a profit" : "Lost money"}</SectionTitle>
        {on && (
          <span className="text-[12px] font-medium" style={{ color: "var(--warn)" }}>
            mistakes taken out
          </span>
        )}
      </div>
      <p
        className="mt-1 text-4xl font-bold"
        style={{ color: profit >= 0 ? "var(--good)" : "var(--neg)" }}
      >
        {money(profit)}
      </p>
      {projection && (
        <p className="mt-1 text-[13px] text-muted">
          Trending toward {money(projection)} by year end
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tint>
          <p className="text-[12px] text-muted">Money in</p>
          <p className="mt-0.5 text-[18px] font-semibold">{money(rollup.income)}</p>
        </Tint>
        <Tint>
          <p className="text-[12px] text-muted">Money out</p>
          <p className="mt-0.5 text-[18px] font-semibold">{money(out)}</p>
        </Tint>
      </div>
    </Card>
  );
}

// The button Chris asked for: what profit looks like with the start-up mistakes
// taken back out, and the list of what they were. The books themselves never
// change — this is the same year counted a second way.
type MistakeGroup = { category: string; total: number; mistakes: Mistake[] };

// One row per category instead of one row per transaction — a year can flag
// forty small charges under "Advertising" and Jamie only needs the one number
// unless he goes looking. Sorted worst-first, so whatever cost the most sits
// at the top without him having to add anything up.
function groupMistakes(mistakes: Mistake[]): MistakeGroup[] {
  const byCategory = new Map<string, Mistake[]>();
  for (const m of mistakes) {
    const list = byCategory.get(m.category);
    if (list) list.push(m);
    else byCategory.set(m.category, [m]);
  }
  return [...byCategory.entries()]
    .map(([category, list]) => ({
      category,
      total: list.reduce((s, m) => s + m.mistakeAmount, 0),
      mistakes: list,
    }))
    .sort((a, b) => b.total - a.total);
}

function MistakesPanel({
  on,
  onToggle,
  actualProfit,
  fixedProfit,
  difference,
  mistakes,
}: {
  on: boolean;
  onToggle: () => void;
  actualProfit: number;
  fixedProfit: number;
  difference: number;
  mistakes: Mistake[];
}) {
  const total = mistakes.reduce((s, m) => s + m.mistakeAmount, 0);
  const groups = groupMistakes(mistakes);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleGroup = (category: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <Card>
      <button
        onClick={onToggle}
        className="w-full rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors"
        style={
          on
            ? { background: "var(--tint)", color: "var(--text)" }
            : { background: "var(--good)", color: "#fff" }
        }
      >
        {on ? "Show the real numbers" : "Profit after removing mistakes"}
      </button>

      {!on && (
        <p className="mt-2 text-center text-[13px] text-muted">
          {mistakes.length === 1 ? "1 mistake" : `${mistakes.length} mistakes`} marked,{" "}
          {money(total)} in all.
        </p>
      )}

      {on && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Tint>
              <p className="text-[12px] text-muted">What really happened</p>
              <p
                className="mt-0.5 text-[18px] font-semibold"
                style={{ color: actualProfit >= 0 ? "var(--good)" : "var(--neg)" }}
              >
                {money(actualProfit)}
              </p>
            </Tint>
            <Tint>
              <p className="text-[12px] text-muted">Without the mistakes</p>
              <p
                className="mt-0.5 text-[18px] font-semibold"
                style={{ color: fixedProfit >= 0 ? "var(--good)" : "var(--neg)" }}
              >
                {money(fixedProfit)}
              </p>
            </Tint>
          </div>

          <p className="mt-3 text-center text-[14px]">
            The mistakes cost{" "}
            <strong style={{ color: "var(--neg)" }}>{money(Math.abs(difference))}</strong> of profit.
          </p>

          <p className="mt-4 text-[14px] font-medium">What the mistakes were</p>
          <ul className="mt-2 space-y-1">
            {groups.map((g) => {
              const expanded = open.has(g.category);
              return (
                <li key={g.category} className="rounded-xl" style={{ background: "var(--tint)" }}>
                  <button
                    onClick={() => toggleGroup(g.category)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ChevronDown
                        size={15}
                        className="shrink-0 text-muted transition-transform"
                        style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <span className="truncate text-[14px] font-medium">{g.category}</span>
                      <span className="shrink-0 text-[12px] text-muted">
                        ({g.mistakes.length})
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-medium" style={{ color: "var(--neg)" }}>
                      {money(g.total)}
                    </span>
                  </button>

                  {expanded && (
                    <ul className="space-y-2 px-3 pb-3">
                      {g.mistakes.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-baseline justify-between gap-3 rounded-lg bg-card px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px]">{m.name ?? "—"}</p>
                            <p className="text-[11px] text-muted">
                              {shortDate(m.date)}
                              {!m.full && " · part of a bigger charge"}
                              {m.memo && ` · ${m.memo}`}
                            </p>
                          </div>
                          <span
                            className="shrink-0 text-[13px] font-medium"
                            style={{ color: "var(--neg)" }}
                          >
                            {money(m.mistakeAmount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[12px] text-muted">
            The books still show the real amounts — this is just the same year counted a second way.
          </p>
        </>
      )}
    </Card>
  );
}

// Profit month by month. Bars go up from the middle when the month made money
// and down when it lost, so a bad stretch is obvious without reading a number.
function MonthlyStrip({ rollup, on }: { rollup: Rollup; on: boolean }) {
  const months = rollup.monthlyNetProfit;
  const peak = Math.max(...months.map((m) => Math.abs(m)), 1);

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <SectionTitle>Month by month</SectionTitle>
        {on && (
          <span className="text-[12px] font-medium" style={{ color: "var(--warn)" }}>
            mistakes taken out
          </span>
        )}
      </div>
      <div className="mt-4 flex items-stretch gap-1">
        {months.map((v, i) => {
          const pct = (Math.abs(v) / peak) * 100;
          const up = v >= 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center">
              <div className="flex h-12 w-full items-end justify-center">
                {up && (
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${pct}%`, background: "var(--good)" }}
                  />
                )}
              </div>
              <div className="h-px w-full" style={{ background: "var(--border)" }} />
              <div className="flex h-12 w-full items-start justify-center">
                {!up && (
                  <div
                    className="w-full rounded-b"
                    style={{ height: `${pct}%`, background: "var(--neg)" }}
                  />
                )}
              </div>
              <span className="mt-1 text-[9px] text-muted">{MONTHS[i][0]}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Best month {money(Math.max(...months))} · worst month {money(Math.min(...months))}
      </p>
    </Card>
  );
}

// Where the money actually went, line by line.
function Lines({ rollup, on }: { rollup: Rollup; on: boolean }) {
  const income = rollup.lines.filter((l) => l.classification === "income");
  const spending = rollup.lines
    .filter((l) => l.classification !== "income")
    .sort((a, b) => b.amount - a.amount);

  if (income.length === 0 && spending.length === 0) return null;

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <SectionTitle>Line by line</SectionTitle>
        {on && (
          <span className="text-[12px] font-medium" style={{ color: "var(--warn)" }}>
            mistakes taken out
          </span>
        )}
      </div>

      {income.length > 0 && (
        <>
          <p className="mt-3 text-[13px] font-medium text-muted">Money coming in</p>
          <ul className="mt-1 space-y-1">
            {income.map((l) => (
              <li key={l.code} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px]">{l.label}</span>
                <span className="shrink-0 text-[14px] font-medium" style={{ color: "var(--good)" }}>
                  {money(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {spending.length > 0 && (
        <>
          <p className="mt-4 text-[13px] font-medium text-muted">Money going out</p>
          <ul className="mt-1 space-y-1">
            {spending.map((l) => (
              <li key={l.code} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px]">{l.label}</span>
                <span className="shrink-0 text-[14px] font-medium">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(rollup.untagged.income !== 0 ||
        rollup.untagged.cogs !== 0 ||
        rollup.untagged.expense !== 0) && (
        <p className="mt-3 text-[12px] text-muted">
          Some of the total isn&apos;t sorted into a line yet, so the lines above add up to less
          than the big numbers.
        </p>
      )}
    </Card>
  );
}
