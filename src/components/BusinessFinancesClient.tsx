"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card, Tint } from "@/components/ui";
import type { BusinessFinances, Mistake, Rollup, ScheduleCLine, ScheduleCLineTx } from "@/lib/businessFinances";
import { showsProfit } from "@/lib/businessFinances";
import {
  cutLines,
  headlineFor,
  modeById,
  VIEW_MODES,
  type CutLine,
  type ViewMode,
  type ViewModeId,
} from "@/lib/businessViewModes";

// ── The gym's books, as Jamie sees them ──────────────────────────────────────
// Every section here is one of Chris's tick-boxes in the Money App (Settings →
// Shared access). A section that isn't ticked never arrives — so an empty list
// and a hidden list look the same from in here, and that's on purpose: this
// component draws what it was sent and doesn't try to explain the gaps.
//
// WHICH CUT is a URL question, not component state. Four of the five modes
// change what Money App is asked for, so they can't be a `useState` toggle
// anyway — and putting all five in `?view=` means every mode is a link Chris
// can send, the back button steps between them, and a reload doesn't quietly
// drop Jamie back on a different set of numbers than he left on.
//
// Year tabs are now expandable dropdowns showing months. All start collapsed.

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

export default function BusinessFinancesClient({
  data,
  modeId,
  jamiePay,
}: {
  data: BusinessFinances;
  modeId: ViewModeId;
  /** Jamie's earned pay for this period, from the gym dashboard — null when
   *  it couldn't be reached, which just means the toggle in Headline stays
   *  disabled rather than the page breaking. */
  jamiePay: number | null;
}) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // The chevron toggles open/closed without changing what's loaded — lets
  // Jamie peek at a year's months without leaving the page he's on.
  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  // Clicking the year itself always opens its months (never collapses) —
  // it's paired with a Link that navigates to that year's annual view, so
  // the two happen together on one click.
  const expandYear = (year: number) => {
    setExpandedYears((prev) => (prev.has(year) ? prev : new Set(prev).add(year)));
  };

  const { view, noMistakes } = data;
  // Chris's tick-box wins over the URL: a `?view=fed` link opened after he
  // switched FED hiding on would otherwise show a headline promising a
  // difference the feed can no longer describe.
  const offerFed = !data.view.hide_fed;
  const mode = modeById(modeId === "fed" && !offerFed ? "full" : modeId);

  // A year with no mistakes marked still has a `noMistakes` block, just an
  // empty one — so whether the clean cut is worth offering is a question about
  // the list, not about the block being there.
  const hasMistakes = Boolean(noMistakes && noMistakes.mistakes.length > 0);
  // Showing "minus our mistakes" over a year with none marked would promise a
  // different number and then show the same one. Fall back to the plain
  // figures instead, and the picker below drops the option entirely.
  const cleanShowing = mode.noMistakes && hasMistakes;
  const rollup: Rollup = cleanShowing && noMistakes ? noMistakes.rollup : data.actual;

  // Switching cuts keeps the year/month you're on, and switching year/month
  // keeps the cut — neither picker resets the other.
  const hrefFor = (id: ViewModeId) => {
    const params = new URLSearchParams();
    if (data.year === "all-time") params.set("year", "all-time");
    else {
      params.set("year", String(data.year));
      if (data.month) params.set("month", String(data.month));
    }
    params.set("view", id);
    return `/business-finances?${params.toString()}`;
  };

  // Both sides of the mistakes comparison read through the CUT ON SCREEN, not
  // a fixed basis: the two roll-ups came down in the same response under the
  // same switches, so measuring them the same way is what makes the difference
  // below equal the gap between the two figures shown. (Money App's own
  // `profitDifference` is worked out against `netProfit` regardless of cut,
  // which is a different basis than this panel displays.)
  const actualProfit = headlineFor(data.actual, mode).profit;
  const fixedProfit = noMistakes ? headlineFor(noMistakes.rollup, mode).profit : actualProfit;

  const linesSection = view.show_schedule_c ? <Lines rollup={rollup} mode={mode} /> : null;

  return (
    <div className="space-y-4">
      <IntroCard
        data={data}
        modeId={modeId}
        expandedYears={expandedYears}
        onToggleYear={toggleYear}
        onSelectYear={expandYear}
      />

      {showsProfit(view) && (
        <ViewPicker
          mode={mode}
          hrefFor={hrefFor}
          offerClean={hasMistakes}
          offerFed={offerFed}
        />
      )}

      {view.show_headline && (
        <Headline
          rollup={rollup}
          mode={mode}
          year={data.year}
          month={data.month}
          jamiePay={jamiePay}
        />
      )}

      {view.show_headline && (
        <CutDetailCard rollup={rollup} mode={mode} allowFed={offerFed} />
      )}

      {/* The CPA cut leads with the tax lines: the question it answers is
          "which box does this go in", so the breakdown IS the answer and the
          month-by-month strip is beside the point. Every other cut keeps the
          strip first, where it's always been. */}
      {mode.taxLayout && linesSection}

      {hasMistakes && noMistakes && (
        <MistakesPanel
          on={cleanShowing}
          toggleHref={hrefFor(cleanShowing ? "full" : "clean")}
          actualProfit={actualProfit}
          fixedProfit={fixedProfit}
          difference={fixedProfit - actualProfit}
          mistakes={noMistakes.mistakes}
        />
      )}

      {view.show_monthly && (
        <MonthlyStrip rollup={rollup} mode={mode} labels={data.monthLabels} />
      )}

      {!mode.taxLayout && linesSection}

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

// Repeated in the corner of every section that shows a figure, so a cut number
// can't be mistaken for the raw one by anyone who scrolled past the headline.
// The full picture has no tag — it's the one that needs no qualifying.
function CutTag({ mode }: { mode: ViewMode }) {
  if (!mode.tag) return null;
  return (
    <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--warn)" }}>
      {mode.tag}
    </span>
  );
}

// A small on/off pill for a subtraction that isn't one of the five cuts —
// see the note on Headline. Disabled rather than hidden when there's nothing
// to subtract, so the reason ("couldn't reach the gym dashboard") is a
// tooltip away instead of the option just vanishing.
function ToggleChip({
  label,
  on,
  onClick,
  disabled,
  title,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-40"
      style={
        on && !disabled
          ? { background: "var(--good)", color: "#fff", borderColor: "var(--good)" }
          : undefined
      }
    >
      {label}
    </button>
  );
}

// The question at the top of the page: five ways to read the same year.
//
// Links, not buttons — four of the five change what Money App is asked for
// (see the note at the top of this file). Stacked full-width rather than a row
// of chips because each one needs its sentence: "Slim view" means nothing on
// its own, and a mode nobody can tell apart from its neighbour is the problem
// this card exists to fix.
function ViewPicker({
  mode,
  hrefFor,
  offerClean,
  offerFed,
}: {
  mode: ViewMode;
  hrefFor: (id: ViewModeId) => string;
  offerClean: boolean;
  offerFed: boolean;
}) {
  const modes = VIEW_MODES.filter(
    (m) => (m.id !== "clean" || offerClean) && (m.id !== "fed" || offerFed),
  );

  return (
    <Card>
      <SectionTitle>How do you want to see the numbers?</SectionTitle>
      <p className="mt-1 text-[13px] text-muted">
        Same books every time. Each one just leaves something different out.
      </p>
      <div className="mt-3 space-y-2">
        {modes.map((m) => {
          const active = m.id === mode.id;
          return (
            <Link
              key={m.id}
              href={hrefFor(m.id)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className="block rounded-xl border px-3 py-2.5 transition-colors"
              style={
                active
                  ? { background: "var(--good)", borderColor: "var(--good)", color: "#fff" }
                  : { borderColor: "var(--border)" }
              }
            >
              <p className="text-[14px] font-semibold">{m.label}</p>
              <p
                className="mt-0.5 text-[12px]"
                style={active ? { color: "rgba(255,255,255,0.88)" } : { color: "var(--muted)" }}
              >
                {m.blurb}
              </p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

// The year (expandable to months), how current the books are, and — when more
// than one year is allowed — the other years to jump to. Year tabs are now
// collapsible dropdowns showing 12 months. "All Time" is a special non-expandable tab.
function IntroCard({
  data,
  modeId,
  expandedYears,
  onToggleYear,
  onSelectYear,
}: {
  data: BusinessFinances;
  modeId: ViewModeId;
  expandedYears: Set<number>;
  onToggleYear: (year: number) => void;
  onSelectYear: (year: number) => void;
}) {
  const isAllTime = data.year === "all-time";
  const headerText = isAllTime ? "The gym's money, all time" : `The gym's money, ${data.year}`;

  let dateRangeText = "";
  if (isAllTime) {
    dateRangeText = `From 11/27/24 through ${data.throughDate ? shortDate(data.throughDate) : "today"}`;
  } else if (data.month) {
    dateRangeText = `${MONTHS[data.month - 1]} ${data.year}`;
  } else if (data.throughDate) {
    dateRangeText = `Counted up to ${shortDate(data.throughDate)}`;
  }

  // Carries the chosen cut across a year/month/all-time click, so picking a
  // different month doesn't silently drop Jamie back on the default view.
  const withView = (href: string) => `${href}&view=${modeId}`;

  return (
    <Card>
      <p className="text-[15px] font-medium">{headerText}</p>
      <p className="mt-1 text-[13px] text-muted">
        Straight from Chris&apos;s accounting app. He picks what shows up here.
        {dateRangeText && ` ${dateRangeText}.`}
      </p>

      {data.years.length > 0 && (
        <div className="mt-3 space-y-2">
          {/* All Time tab - never expandable */}
          <Link
            href={withView("/business-finances?year=all-time")}
            scroll={false}
            className="inline-block rounded-lg border border-border px-3 py-1 text-[13px]"
            style={
              isAllTime
                ? { background: "var(--good)", color: "#fff", borderColor: "var(--good)" }
                : undefined
            }
          >
            All Time
          </Link>

          {/* Year tabs - expandable to show months */}
          <div className="space-y-2">
            {data.years.map((y) => {
              const isExpanded = expandedYears.has(y);
              const isCurrentYear = y === data.year && !isAllTime;
              const isCurrentMonth = isCurrentYear && data.month;

              return (
                <div key={y}>
                  {/* Chevron: toggles the months open/closed without navigating. */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleYear(y)}
                      aria-label={isExpanded ? "Collapse months" : "Expand months"}
                      className="rounded-lg p-1.5 transition-colors hover:bg-tint"
                    >
                      <ChevronDown
                        size={14}
                        className="transition-transform"
                        style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                    </button>
                    {/* Year: navigates to that year's annual view and opens its months. */}
                    <Link
                      href={withView(`/business-finances?year=${y}`)}
                      scroll={false}
                      onClick={() => onSelectYear(y)}
                      className="rounded-lg border border-border px-3 py-1 text-[13px]"
                      style={
                        isCurrentYear && !isCurrentMonth
                          ? { background: "var(--good)", color: "#fff", borderColor: "var(--good)" }
                          : undefined
                      }
                    >
                      {y}
                    </Link>
                  </div>

                  {/* Month dropdown - shown when expanded */}
                  {isExpanded && (
                    <div className="ml-6 mt-2 flex flex-wrap gap-2">
                      {MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isSelectedMonth = isCurrentMonth && data.month === monthNum;

                        return (
                          <Link
                            key={idx}
                            href={withView(`/business-finances?year=${y}&month=${monthNum}`)}
                            scroll={false}
                            className="rounded-lg border border-border px-2 py-1 text-[12px]"
                            style={
                              isSelectedMonth
                                ? {
                                    background: "var(--good)",
                                    color: "#fff",
                                    borderColor: "var(--good)",
                                  }
                                : undefined
                            }
                          >
                            {month}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </Card>
  );
}

// What this cut left out, and what it counted that another cut wouldn't —
// itemized, because "leaves out one-off spending" is exactly the sentence that
// makes someone go and ask WHICH one-off spending.
//
// Both lists, always. Showing only the exclusions reads as though the other
// cuts are the honest ones; showing both makes the point that these are the
// same four things every time, counted or not.
function CutDetailCard({
  rollup,
  mode,
  allowFed,
}: {
  rollup: Rollup;
  mode: ViewMode;
  allowFed: boolean;
}) {
  const { leftOut, counted } = cutLines(rollup, mode, { allowFed });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // An older Money App sends no detail at all, and the full picture leaves
  // nothing out. Either way there's no card to draw.
  if (leftOut.length === 0 && counted.length === 0) return null;

  return (
    <Card>
      <SectionTitle>What this view leaves in and out</SectionTitle>
      <p className="mt-1 text-[13px] text-muted">
        Tap any line to see exactly what&apos;s in it.
      </p>

      {leftOut.length > 0 && (
        <>
          <p className="mt-3 text-[13px] font-medium text-muted">Left out of the numbers above</p>
          <ul className="mt-1 space-y-1">
            {leftOut.map((l) => (
              <CutRow
                key={l.key}
                line={l}
                open={open.has(l.key)}
                onToggle={() => toggle(l.key)}
                tone="out"
              />
            ))}
          </ul>
        </>
      )}

      {counted.length > 0 && (
        <>
          <p className="mt-4 text-[13px] font-medium text-muted">
            Counted here — other views leave these out
          </p>
          <ul className="mt-1 space-y-1">
            {counted.map((l) => (
              <CutRow
                key={l.key}
                line={l}
                open={open.has(l.key)}
                onToggle={() => toggle(l.key)}
                tone="in"
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// One reason, expandable to the categories behind it. Same interaction as the
// mistakes list and the line-by-line breakdown, so nothing here is a new thing
// to learn.
function CutRow({
  line,
  open,
  onToggle,
  tone,
}: {
  line: CutLine;
  open: boolean;
  onToggle: () => void;
  tone: "in" | "out";
}) {
  // Independent of the category-level `open` above — a category expands to
  // its items with the outer toggle, and each item expands to its own
  // transactions with its own, same two-level shape as Line by line.
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const toggleItem = (label: string) =>
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <li className="rounded-xl" style={{ background: "var(--tint)" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronDown
            size={15}
            className="shrink-0 text-muted transition-transform"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium">{line.label}</span>
            <span className="block text-[11px] leading-snug text-muted">{line.blurb}</span>
          </span>
        </span>
        <span
          className="shrink-0 text-[14px] font-medium"
          style={{ color: tone === "in" ? "var(--text)" : "var(--muted)" }}
        >
          {money(Math.abs(line.bucket.total))}
        </span>
      </button>

      {open && (
        <ul className="space-y-1 px-3 pb-3">
          {line.bucket.items.map((item) => {
            const txs = item.transactions ?? [];
            const itemOpen = openItems.has(item.label);
            return (
              <li key={item.label} className="rounded-lg bg-card">
                <button
                  onClick={() => txs.length > 0 && toggleItem(item.label)}
                  className="flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {txs.length > 0 && (
                      <ChevronDown
                        size={12}
                        className="shrink-0 text-muted transition-transform"
                        style={{ transform: itemOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{item.label}</span>
                      <span className="block text-[11px] text-muted">
                        {item.count === 1 ? "1 entry" : `${item.count} entries`}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-medium">
                    {money(Math.abs(item.amount))}
                  </span>
                </button>

                {itemOpen && txs.length > 0 && (
                  <ul className="space-y-1.5 px-2.5 pb-2.5">
                    {txs.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5"
                        style={{ background: "var(--tint)" }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px]">{t.name ?? "—"}</p>
                          <p className="text-[10px] text-muted">
                            {shortDate(t.date)}
                            {t.memo && ` · ${t.memo}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12px] font-medium">
                          {money(Math.abs(t.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// Money in, money out, what's left. The three numbers everything else explains.
function Headline({
  rollup,
  mode,
  year,
  month,
  jamiePay,
}: {
  rollup: Rollup;
  mode: ViewMode;
  year: number | "all-time";
  month?: number;
  jamiePay: number | null;
}) {
  // What "money in", "money out" and "profit" mean depends on the cut — see
  // headlineFor. The three always tie out, so the two tiles explain the big
  // number rather than sitting near it.
  const { moneyIn, moneyOut, profit: rawProfit } = headlineFor(rollup, mode);

  // Neither of these is part of any of the five cuts above — a distribution
  // isn't a P&L expense under any of them, and Jamie's pay isn't in Money
  // App's ledger at all (it's the gym dashboard's own figure). They're a
  // second, independent question — "what's left once Jamie's actually been
  // paid?" — so they're plain client toggles rather than another URL mode:
  // no cut to ask Money App for, just arithmetic on numbers already in hand.
  const [includeJamiePay, setIncludeJamiePay] = useState(false);
  const [includeJamieDist, setIncludeJamieDist] = useState(false);
  const jamiePayOut = includeJamiePay ? (jamiePay ?? 0) : 0;
  const jamieDistOut = includeJamieDist ? (rollup.jamieDistributions ?? 0) : 0;
  const profit = rawProfit - jamiePayOut - jamieDistOut;

  // Only show year-end projection for current year, not for months or all-time
  const projection =
    typeof year === "number" && !month ? getYearEndProjection(profit, year) : null;
  // All-time spans however many real months have happened since Nov 2024 —
  // monthlyNetProfit is built to that exact length (see chronologicalMonths
  // in businessFinances.ts) — so annualizing is just scaling the total up to
  // a 12-month pace, the same idea as the year-end projection above but for
  // a span that isn't a single year to begin with.
  const avgAnnualProfit =
    year === "all-time" && rollup.monthlyNetProfit.length > 0
      ? (profit / rollup.monthlyNetProfit.length) * 12
      : null;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>{profit >= 0 ? mode.profitTitle : mode.lossTitle}</SectionTitle>
        <CutTag mode={mode} />
      </div>
      <p
        className="mt-1 text-4xl font-bold"
        style={{ color: profit >= 0 ? "var(--good)" : "var(--neg)" }}
      >
        {money(profit)}
      </p>
      {(jamiePayOut !== 0 || jamieDistOut !== 0) && (
        <p className="mt-1 text-[12px] text-muted">
          After
          {jamiePayOut !== 0 && ` ${money(jamiePayOut)} of Jamie's pay`}
          {jamiePayOut !== 0 && jamieDistOut !== 0 && " and"}
          {jamieDistOut !== 0 && ` ${money(jamieDistOut)} of distributions`}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <ToggleChip
          label="Include Jamie's earned pay"
          on={includeJamiePay}
          onClick={() => setIncludeJamiePay((v) => !v)}
          disabled={jamiePay == null}
          title={
            jamiePay == null
              ? "Couldn't reach the gym dashboard for this period."
              : "Subtracts what the gym dashboard's pay model says Jamie earned."
          }
        />
        <ToggleChip
          label="Include Jamie's full distributions"
          on={includeJamieDist}
          onClick={() => setIncludeJamieDist((v) => !v)}
          disabled={!rollup.jamieDistributions}
          title="Subtracts everything drawn from Jamie's distribution tree — Taycan, Equinox, Charges, Transfers, Car Insurance."
        />
      </div>
      {projection && (
        <p className="mt-1 text-[13px] text-muted">
          Trending toward {money(projection)} by year end
        </p>
      )}
      {avgAnnualProfit !== null && (
        <p className="mt-1 text-[13px] text-muted">
          Averages to {money(avgAnnualProfit)} a year
        </p>
      )}
      {/* The same sentence as the picked button up in the selector, repeated
          under the number itself — this is the one place a figure gets quoted
          out of context, so what it leaves out travels with it. */}
      <p className="mt-1 text-[13px] text-muted">{mode.blurb}</p>
      <p className="mt-1 text-[12px] text-muted">
        Doesn&apos;t include Jamie&apos;s PT cash that hasn&apos;t been recorded yet.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tint>
          <p className="text-[12px] text-muted">Money in</p>
          <p className="mt-0.5 text-[18px] font-semibold">{money(moneyIn)}</p>
          {/* Grant money is the single biggest reason this tile disagrees with
              a figure on Chris's own screens: the operating cut leaves it out
              entirely, every other cut folds it in, and his Reports page keeps
              it out of "Revenue" and adds it back lower down. Saying the
              amount HERE answers that without anyone having to ask. */}
          {rollup.otherIncome !== 0 && (
            <p className="mt-1 text-[11px] leading-snug text-muted">
              {mode.operational ? "Leaves out " : "Includes "}
              {money(rollup.otherIncome)} of grant money
            </p>
          )}
        </Tint>
        <Tint>
          <p className="text-[12px] text-muted">Money out</p>
          <p className="mt-0.5 text-[18px] font-semibold">{money(moneyOut)}</p>
          {/* Same idea on the other side — interest is what separates the
              full picture from the gym's own numbers. */}
          {(rollup.financeCharges ?? 0) !== 0 && (
            <p className="mt-1 text-[11px] leading-snug text-muted">
              {mode.operational ? "Leaves out " : "Includes "}
              {money(rollup.financeCharges ?? 0)} of loan interest
            </p>
          )}
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
  toggleHref,
  actualProfit,
  fixedProfit,
  difference,
  mistakes,
}: {
  on: boolean;
  /** Where the button goes — the clean cut, or back to the full picture.
   *  A link rather than local state, because "minus our mistakes" is one of
   *  the five modes in the picker above and the two must never disagree
   *  about which one is showing. */
  toggleHref: string;
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
      <Link
        href={toggleHref}
        scroll={false}
        className="block w-full rounded-xl px-4 py-3 text-center text-[15px] font-semibold transition-colors"
        style={
          on
            ? { background: "var(--tint)", color: "var(--text)" }
            : { background: "var(--good)", color: "#fff" }
        }
      >
        {on ? "Show the real numbers" : "Profit after removing mistakes"}
      </Link>

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
// `labels` overrides the default Jan–Dec letters — required whenever the
// array can run longer than 12 entries (the all-time view spans multiple
// years), since indexing the fixed MONTHS array past 11 would crash.
function MonthlyStrip({
  rollup,
  mode,
  labels,
}: {
  rollup: Rollup;
  mode: ViewMode;
  labels?: string[];
}) {
  const months = rollup.monthlyNetProfit;
  const peak = Math.max(...months.map((m) => Math.abs(m)), 1);
  // Also doubles as a tap target on mobile — click toggles the same tooltip
  // hover shows, since there's no hover on a touchscreen.
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>Month by month</SectionTitle>
        <CutTag mode={mode} />
      </div>
      <div className="mt-4 flex items-stretch gap-1">
        {months.map((v, i) => {
          const pct = (Math.abs(v) / peak) * 100;
          const up = v >= 0;
          const label = labels ? labels[i] : MONTHS[i];
          return (
            <div
              key={i}
              className="relative flex flex-1 flex-col items-center"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              onClick={() => setHovered((h) => (h === i ? null : i))}
            >
              {hovered === i && (
                <div
                  className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-md"
                  style={{ background: "var(--text)", color: "var(--card)" }}
                >
                  {label}: {money(v)}
                </div>
              )}
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
              <span className="mt-1 text-[9px] text-muted">{labels ? labels[i] : MONTHS[i][0]}</span>
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

// Where the money actually went, line by line. Every category expands to the
// individual transactions behind it — same interaction as the mistakes list
// above, so a category isn't just a number Jamie has to take on faith.
function Lines({ rollup, mode }: { rollup: Rollup; mode: ViewMode }) {
  const income = rollup.lines.filter((l) => l.classification === "income");
  const spending = rollup.lines
    .filter((l) => l.classification !== "income")
    .sort((a, b) => b.amount - a.amount);

  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  if (income.length === 0 && spending.length === 0) return null;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>{mode.taxLayout ? "Line by line, as the tax return sees it" : "Line by line"}</SectionTitle>
        <CutTag mode={mode} />
      </div>

      {/* Only said in the CPA cut, where it's the whole point: these headings
          are the boxes on Schedule C, and a grant is taxable income even
          though the operating view carves it out. */}
      {mode.taxLayout && (
        <p className="mt-1 text-[13px] text-muted">
          These headings are the boxes on the tax form. Grant money counts as
          income here, even though it&apos;s left out of the gym&apos;s own numbers.
        </p>
      )}

      {income.length > 0 && (
        <>
          <p className="mt-3 text-[13px] font-medium text-muted">Money coming in</p>
          <ul className="mt-1 space-y-1">
            {income.map((l) => (
              <LineRow key={l.code} line={l} open={open.has(l.code)} onToggle={() => toggle(l.code)} good />
            ))}
          </ul>
        </>
      )}

      {spending.length > 0 && (
        <>
          <p className="mt-4 text-[13px] font-medium text-muted">Money going out</p>
          <ul className="mt-1 space-y-1">
            {spending.map((l) => (
              <LineRow key={l.code} line={l} open={open.has(l.code)} onToggle={() => toggle(l.code)} />
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

// The last segment of the ledger path — "Sales:Recurring Memberships"
// reads as "Recurring Memberships" once it's under its Schedule C header.
// A Money App too old to send `accountPath` — or one mid-deploy, which is
// exactly how this first bit — leaves it undefined, and reaching straight for
// `.includes` on that took the whole page down with "This page couldn't load".
//
// Every other cross-app read in this app treats a missing field as a thinner
// answer rather than a crash (see the "an older Money App won't send them"
// notes through src/lib/moneyapp.ts). This one has to as well: the two apps
// deploy separately and there is always a window where one is ahead.
function accountLeaf(path: string | null | undefined): string {
  const trimmed = path?.trim();
  if (!trimmed) return UNGROUPED;
  return trimmed.includes(":") ? trimmed.split(":").pop()!.trim() : trimmed;
}

// What the one group is called when there's no account to split by. It reads
// as a plain heading rather than an error, because for Jamie it isn't one —
// the transactions are all still there, just not grouped.
const UNGROUPED = "All transactions";

type AccountGroup = { account: string; total: number; txs: ScheduleCLineTx[] };

// One Schedule C line is usually several real accounts folded into one tax
// category — "Gross receipts or sales" is Stripe, ClassPass, guest passes and
// more, all at once. Splitting by account before listing transactions is
// what makes a 177-transaction category actually readable, same as Money
// App's own P&L page groups a category into its accounts.
function groupByAccount(txs: ScheduleCLineTx[]): AccountGroup[] {
  const byAccount = new Map<string, ScheduleCLineTx[]>();
  for (const t of txs) {
    const leaf = accountLeaf(t.accountPath);
    const list = byAccount.get(leaf);
    if (list) list.push(t);
    else byAccount.set(leaf, [t]);
  }
  return [...byAccount.entries()]
    .map(([account, list]) => ({
      account,
      total: list.reduce((s, t) => s + t.amount, 0),
      txs: [...list].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

// One Schedule C category — its accounts, and (once an account is tapped)
// the individual transactions behind it. `transactions` can be empty even
// with a non-zero amount (untagged accounts, or an older cached response);
// the row still opens, it just has nothing to list.
function LineRow({
  line,
  open,
  onToggle,
  good,
}: {
  line: ScheduleCLine;
  open: boolean;
  onToggle: () => void;
  good?: boolean;
}) {
  const txs = line.transactions ?? [];
  const groups = groupByAccount(txs);
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const toggleAccount = (account: string) =>
    setOpenAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      return next;
    });

  return (
    <li className="rounded-xl" style={{ background: "var(--tint)" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronDown
            size={14}
            className="shrink-0 text-muted transition-transform"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <span className="truncate text-[14px]">{line.label}</span>
          {txs.length > 0 && (
            <span className="shrink-0 text-[12px] text-muted">({txs.length})</span>
          )}
        </span>
        <span
          className="shrink-0 text-[14px] font-medium"
          style={good ? { color: "var(--good)" } : undefined}
        >
          {money(line.amount)}
        </span>
      </button>

      {open && (
        <ul className="space-y-1.5 px-3 pb-3">
          {groups.length === 0 ? (
            <li className="text-[12px] text-muted">No individual transactions to show.</li>
          ) : (
            groups.map((g) => {
              const gOpen = openAccounts.has(g.account);
              return (
                <li key={g.account} className="rounded-lg bg-card">
                  <button
                    onClick={() => toggleAccount(g.account)}
                    className="flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ChevronDown
                        size={12}
                        className="shrink-0 text-muted transition-transform"
                        style={{ transform: gOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <span className="truncate text-[13px] font-medium">{g.account}</span>
                      <span className="shrink-0 text-[11px] text-muted">({g.txs.length})</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium">{money(g.total)}</span>
                  </button>

                  {gOpen && (
                    <ul className="space-y-1.5 px-2.5 pb-2.5">
                      {g.txs.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5"
                          style={{ background: "var(--tint)" }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12px]">{t.name ?? "—"}</p>
                            <p className="text-[10px] text-muted">
                              {shortDate(t.date)}
                              {t.memo && ` · ${t.memo}`}
                            </p>
                          </div>
                          <span className="shrink-0 text-[12px] font-medium">
                            {money(t.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </li>
  );
}
