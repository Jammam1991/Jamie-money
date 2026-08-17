"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Card, Tint } from "@/components/ui";
import type { BusinessFinances, Mistake, Rollup, ScheduleCLine, ScheduleCLineTx } from "@/lib/businessFinances";
import { showsProfit } from "@/lib/businessFinances";
import {
  cutLines,
  displayMode,
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
// WHICH CUT is a URL question, not component state. All four modes change
// what Money App is asked for, so they can't be a `useState` toggle anyway —
// and putting them in `?view=` means every mode is a link Chris can send, the
// back button steps between them, and a reload doesn't quietly drop Jamie
// back on a different set of numbers than he left on. "Mistakes taken out" is
// a second, orthogonal URL question (`?clean=1`) — see the note on
// `readClean` in businessViewModes.ts — so it can be layered on top of
// whichever of the four cuts is picked without swapping the cut out.
//
// LAYOUT: the sum comes first and everything else is shut. Jamie is not an
// accountant, and the page used to open on a five-way question about which
// accounting cut to apply — the answer was three scrolls below the choice. Now
// the top card is the whole arithmetic in one column, and the pickers, the
// category breakdown and the "what's left out" list sit under it behind a
// chevron, each labelled with what it's currently set to.

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
  clean,
  jamiePay,
}: {
  data: BusinessFinances;
  modeId: ViewModeId;
  /** Whether "mistakes taken out" is on. A toggle layered on top of `modeId`,
   *  not a fifth mode — see the note on `readClean` — so switching it doesn't
   *  also switch which of the four cuts is on screen. */
  clean: boolean;
  /** Jamie's earned pay for this period, from the gym dashboard — null when
   *  it couldn't be reached, which just means the toggle in MoneyStory stays
   *  disabled rather than the page breaking. */
  jamiePay: number | null;
}) {
  const { view, noMistakes } = data;
  // Whether FED can be NAMED on this screen. The tax view drops those items
  // either way — when Chris's tick-box is on they never reach the feed at all,
  // so there's nothing left to drop — but saying "leaving out everything Chris
  // tagged FED" out loud would undo the hiding he asked for. So this gates the
  // wording and the itemised list, not the cut itself.
  const offerFed = !data.view.hide_fed;
  const mode = modeById(modeId);

  // A year with no mistakes marked still has a `noMistakes` block, just an
  // empty one — so whether the toggle is worth offering is a question about
  // the list, not about the block being there.
  const hasMistakes = Boolean(noMistakes && noMistakes.mistakes.length > 0);
  // Showing "minus our mistakes" over a year with none marked would promise a
  // different number and then show the same one. Fall back to the plain
  // figures instead, and the panel below doesn't render at all.
  const cleanShowing = clean && hasMistakes;
  const rollup: Rollup = cleanShowing && noMistakes ? noMistakes.rollup : data.actual;
  // Same cut, mistakes-aware wording — see `displayMode`.
  const shownMode = displayMode(mode, cleanShowing);

  // Switching cuts keeps the year/month AND the mistakes toggle; switching the
  // toggle keeps the cut; switching year/month keeps both. No picker resets
  // another one just by being touched.
  const hrefFor = (id: ViewModeId, wantClean: boolean = clean) => {
    const params = new URLSearchParams();
    if (data.year === "all-time") params.set("year", "all-time");
    else {
      params.set("year", String(data.year));
      if (data.month) params.set("month", String(data.month));
    }
    params.set("view", id);
    if (wantClean) params.set("clean", "1");
    return `/business-finances?${params.toString()}`;
  };

  // Both sides of the mistakes comparison read through the CUT ON SCREEN, not
  // a fixed basis: the two roll-ups came down in the same response under the
  // same switches, so measuring them the same way is what makes the difference
  // below equal the gap between the two figures shown. (Money App's own
  // `profitDifference` is worked out against `netProfit` regardless of cut,
  // which is a different basis than this panel displays.) `mode` here is
  // always one of the four real cuts — never a stand-in "clean" mode that
  // would silently swap operating/seller/cpa back to the full picture — so
  // this stays correct under whichever cut the toggle was clicked from.
  const actualProfit = headlineFor(data.actual, mode).profit;
  const fixedProfit = noMistakes ? headlineFor(noMistakes.rollup, mode).profit : actualProfit;

  // The answer, then the two ways to change it, then the detail behind it.
  // Nothing above the sum, because nothing else is what Jamie came for.
  return (
    <div className="space-y-4">
      {/* Two dropdowns, nothing else up top: which stretch of time, and which
          of the four cuts to read it through. Everything below answers to
          whatever these two say (plus the mistakes toggle, if it's on). */}
      <div className="flex flex-wrap gap-2">
        <DateDropdown data={data} modeId={modeId} clean={clean} />
        {showsProfit(view) && <ViewDropdown mode={mode} hrefFor={hrefFor} />}
      </div>

      {view.show_headline && (
        <Totals
          rollup={rollup}
          mode={shownMode}
          year={data.year}
          month={data.month}
          range={data.range}
          throughDate={data.throughDate}
          jamiePay={jamiePay}
          showCategories={view.show_schedule_c}
        />
      )}

      {hasMistakes && noMistakes && (
        <MistakesPanel
          on={cleanShowing}
          toggleHref={hrefFor(modeId, !cleanShowing)}
          actualProfit={actualProfit}
          fixedProfit={fixedProfit}
          difference={fixedProfit - actualProfit}
          mistakes={noMistakes.mistakes}
        />
      )}

      {view.show_monthly && (
        <MonthlyStrip rollup={rollup} mode={shownMode} labels={data.monthLabels} />
      )}

      {/* Last, and shut: this explains why the sum at the top isn't the same as
          some other cut of it. Worth having, never the first thing to read. */}
      {view.show_headline && (
        <CutDetailCard rollup={rollup} mode={shownMode} allowFed={offerFed} />
      )}

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

// A section that's shut until you want it.
//
// Everything on this page except the sum itself now lives behind one of these.
// The page used to lay all of it out at once — a five-option accounting
// question, forty date buttons, two expandable breakdowns — above and around
// the one number Jamie came for. Shut by default, each one still says in its
// header what it's currently set to, so nothing is hidden, only folded.
function Disclosure({
  title,
  summary,
  tag,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** What it's set to right now, so the closed state still answers the question. */
  summary?: React.ReactNode;
  tag?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{title}</span>
          {summary && <span className="block text-[13px] text-muted">{summary}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {tag}
          <ChevronDown
            size={18}
            className="text-muted transition-transform"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}

// Four ways to read the same books, as one dropdown.
//
// A stacked-card picker used to spell out each mode's sentence in full — worth
// it when the page had room for it, but Jamie asked for a front that's just
// the three numbers and two selectors. The words for what each cut leaves out
// still live in businessViewModes.ts and still show up in "What these numbers
// leave in and out" below; this control is just how you switch between them.
// "Without the start-up mistakes" isn't one of the four — that's the separate
// toggle in the mistakes panel below, which stacks on top of whichever of
// these is picked here instead of replacing it.
function ViewDropdown({
  mode,
  hrefFor,
}: {
  mode: ViewMode;
  hrefFor: (id: ViewModeId) => string;
}) {
  const router = useRouter();

  return (
    <select
      value={mode.id}
      onChange={(e) => router.push(hrefFor(e.target.value as ViewModeId), { scroll: false })}
      aria-label="Count it a different way"
      className="flex-1 rounded-xl border-2 bg-card px-3 py-2.5 text-[14px] font-semibold"
      style={{ borderColor: "var(--muted)" }}
    >
      {VIEW_MODES.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

// Which stretch of time to look at, as one dropdown — every year Money App
// will hand over, each with its own twelve months grouped underneath it.
function DateDropdown({
  data,
  modeId,
  clean,
}: {
  data: BusinessFinances;
  modeId: ViewModeId;
  clean: boolean;
}) {
  const router = useRouter();
  if (data.years.length === 0) return null;

  const isAllTime = data.year === "all-time";
  const value = isAllTime
    ? "all-time"
    : data.month
      ? `month-${data.year}-${data.month}`
      : `year-${data.year}`;

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [kind, y, m] = e.target.value.split("-");
    const params = new URLSearchParams();
    if (kind === "all") params.set("year", "all-time");
    else {
      params.set("year", y);
      if (kind === "month") params.set("month", m);
    }
    // Carries the chosen cut, and the mistakes toggle, across the change, so
    // picking a different date doesn't silently drop Jamie back on the
    // default view or quietly put the mistakes back in.
    params.set("view", modeId);
    if (clean) params.set("clean", "1");
    router.push(`/business-finances?${params.toString()}`, { scroll: false });
  };

  return (
    <select
      value={value}
      onChange={onChange}
      aria-label="Look at a different time"
      className="flex-1 rounded-xl border-2 bg-card px-3 py-2.5 text-[14px] font-semibold"
      style={{ borderColor: "var(--muted)" }}
    >
      <option value="all-time">All time</option>
      {data.years.map((y) => (
        <optgroup key={y} label={String(y)}>
          <option value={`year-${y}`}>Full year {y}</option>
          {MONTHS.map((month, idx) => (
            <option key={month} value={`month-${y}-${idx + 1}`}>
              {month} {y}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
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
    <Disclosure
      title="What these numbers leave in and out"
      summary={
        leftOut.length > 0
          ? `${leftOut.map((l) => l.label.toLowerCase()).join(", ")} left out`
          : "Nothing left out"
      }
    >
      <p className="text-[13px] text-muted">
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
    </Disclosure>
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

// Three numbers, big, and nothing else — until you tap one.
//
// The page used to open on a five-option question about which accounting cut
// to use, then a big number, then a column of rows explaining it. Jamie asked
// for something his business partner can read in one glance: Total Revenue,
// Total Expenses, Profit, done. Everything that used to sit in that column —
// loan interest, Jamie's pay and distributions, the year-end projection — is
// still here, just folded behind whichever of the three numbers it explains.
function Totals({
  rollup,
  mode,
  year,
  month,
  range,
  throughDate,
  jamiePay,
  showCategories,
}: {
  rollup: Rollup;
  mode: ViewMode;
  year: number | "all-time";
  month?: number;
  range?: { start: string; end: string };
  throughDate: string | null;
  jamiePay: number | null;
  /** Chris's "Schedule C line by line" tick-box. Off means Money App never
   *  sends the category detail, so Revenue and Expenses show a plain number
   *  with nothing to tap open — same rule the rest of this page follows. */
  showCategories: boolean;
}) {
  // What "money in", "money out" and "profit" mean depends on the cut — see
  // headlineFor. Total Expenses folds loan interest into running costs so the
  // three numbers always add up: Revenue − Expenses = Profit, on screen.
  const { moneyIn, moneyOut, interest, profit: rawProfit } = headlineFor(rollup, mode);
  const totalExpenses = moneyOut + interest;

  // Neither of these is part of any of the cuts above — a distribution
  // isn't a P&L expense under any of them, and Jamie's pay isn't in Money
  // App's ledger at all (it's the gym dashboard's own figure). They're a
  // second, independent question — "what's left once Jamie's actually been
  // paid?" — so they're plain client toggles rather than another URL mode.
  //
  // ONE value, not two booleans: the earned-pay figure is already inside the
  // distribution total, so subtracting both took the same money out twice and
  // overstated the loss. They behave like radio buttons — pick one, or neither,
  // never both; clicking the picked one clears back to neither.
  const [jamieCut, setJamieCut] = useState<"none" | "pay" | "dist">("none");
  const jamiePayOut = jamieCut === "pay" ? (jamiePay ?? 0) : 0;
  const jamieDistOut = jamieCut === "dist" ? (rollup.jamieDistributions ?? 0) : 0;
  const profit = rawProfit - jamiePayOut - jamieDistOut;
  const madeMoney = profit >= 0;
  // Jamie's pay/distributions never sit inside `rawProfit` (see the note on
  // `jamieDistributions` in Rollup) — only `jamieCut` above pulls them back
  // out. Say so on the label itself, since "The gym made $41,059" reads like
  // a final number and it isn't one until this line says which cut it is.
  const jamieCutLabel =
    jamieCut === "pay" ? "after Jamie's pay" : jamieCut === "dist" ? "after Jamie's distributions" : "before owner pay";

  // Grant/forgiveness money is its own Schedule C line ("other_income"), and
  // under the gym's-own-money cut `moneyIn` (Total Revenue, above) is built
  // from `rollup.income` alone — which never includes it (see headlineFor).
  // Leaving the "Other income" row in this list under that cut made the
  // category rows add up to MORE than the headline they sit under, off by
  // exactly the grant amount. Every other cut folds grants into `moneyIn`, so
  // the row belongs here for those.
  const income = rollup.lines.filter(
    (l) => l.classification === "income" && !(mode.operational && l.code === "other_income"),
  );
  const spending = rollup.lines
    .filter((l) => l.classification !== "income")
    .sort((a, b) => b.amount - a.amount);

  // Only show year-end projection for current year, not for months or all-time
  const projection =
    typeof year === "number" && !month ? getYearEndProjection(profit, year) : null;
  // All-time spans however many real months have happened since the gym opened
  // — monthlyNetProfit is built to that exact length (see chronologicalMonths
  // in businessFinances.ts) — so annualizing is just scaling the total up to
  // a 12-month pace, the same idea as the year-end projection above but for
  // a span that isn't a single year to begin with.
  const avgAnnualProfit =
    year === "all-time" && rollup.monthlyNetProfit.length > 0
      ? (profit / rollup.monthlyNetProfit.length) * 12
      : null;

  const [open, setOpen] = useState<"revenue" | "expenses" | "profit" | null>(null);
  const toggle = (key: "revenue" | "expenses" | "profit") =>
    setOpen((v) => (v === key ? null : key));

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          <TimeSpan year={year} month={month} range={range} throughDate={throughDate} />
        </p>
        <CutTag mode={mode} />
      </div>

      <div className="mt-1 divide-y" style={{ borderColor: "var(--border)" }}>
        <BigNumberRow
          label="Total Revenue"
          amount={moneyIn}
          color="var(--good)"
          expandable={showCategories}
          open={open === "revenue"}
          onToggle={() => toggle("revenue")}
        >
          {/* Grant money is the single biggest reason this figure disagrees
              with one on Chris's own screens: the gym's-own-money cut leaves it
              out entirely and every other cut folds it in. */}
          {rollup.otherIncome !== 0 && (
            <p className="text-[12px] text-muted">
              {mode.operational ? "Doesn't count" : "Counts"} {money(rollup.otherIncome)} of grant money
            </p>
          )}
          <CategoryList lines={income} positive untagged={rollup.untagged.income} />
        </BigNumberRow>

        <BigNumberRow
          label="Total Expenses"
          amount={totalExpenses}
          color="var(--neg)"
          expandable={showCategories}
          open={open === "expenses"}
          onToggle={() => toggle("expenses")}
        >
          {/* The one number the two apps used to disagree about. Chris's P&L
              keeps interest out of its expenses tile and subtracts it further
              down, so folding it into "running the gym" made the same books
              read $18,273 apart. Its own row here instead, and they match. */}
          {interest !== 0 && (
            <div
              className="flex items-baseline justify-between gap-3 rounded-xl px-3 py-2.5"
              style={{ background: "var(--tint)" }}
            >
              <span className="min-w-0 text-[14px]">
                Loan interest
                <span className="block text-[11px] leading-snug text-muted">
                  The cost of the borrowing, not of running the gym
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-medium">{money(interest)}</span>
            </div>
          )}
          <CategoryList lines={spending} untagged={rollup.untagged.cogs + rollup.untagged.expense} />
        </BigNumberRow>

        <BigNumberRow
          label={`${madeMoney ? mode.profitTitle : mode.lossTitle} (${jamieCutLabel})`}
          amount={profit}
          color={madeMoney ? "var(--good)" : "var(--neg)"}
          expandable
          big
          open={open === "profit"}
          onToggle={() => toggle("profit")}
          // The two "what if Jamie's pay came out of this too?" questions used
          // to be full-width buttons behind the tap — right next to the number
          // they change is where Jamie actually looks for them.
          toggle={
            <JamieToggle
              jamieCut={jamieCut}
              setJamieCut={setJamieCut}
              jamiePay={jamiePay}
              jamieDistributions={rollup.jamieDistributions}
            />
          }
        >
          {(projection || avgAnnualProfit !== null) && (
            <p className="text-[13px] text-muted">
              {projection
                ? `Heading for about ${money(projection)} by the end of the year.`
                : `That's about ${money(avgAnnualProfit!)} a year.`}
            </p>
          )}
          <p className="text-[12px] text-muted">
            Jamie&apos;s PT cash that hasn&apos;t been written down yet isn&apos;t in here.
          </p>
        </BigNumberRow>
      </div>
    </Card>
  );
}

// One of the three numbers. Big enough to read at a glance; a tap opens
// exactly what's behind it, same interaction as every other drill-down on
// this page. Non-expandable rows (Chris's Schedule C tick-box is off) render
// as a plain row — no chevron promising a detail that isn't coming.
function BigNumberRow({
  label,
  amount,
  color,
  expandable,
  open,
  onToggle,
  big,
  toggle,
  children,
}: {
  label: string;
  amount: number;
  color: string;
  expandable: boolean;
  open: boolean;
  onToggle: () => void;
  /** The profit row reads a size up from Revenue and Expenses — it's the answer. */
  big?: boolean;
  /** A control that changes what the number above it reads — shown next to it
   *  always, not behind the tap, since it isn't a detail, it's a question. */
  toggle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const size = big ? "text-[38px]" : "text-[30px]";
  const inner = (
    <span className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-[14px] font-medium text-muted">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={`${size} font-bold leading-none tabular-nums`} style={{ color }}>
          {money(Math.abs(amount))}
        </span>
        {expandable && (
          <ChevronDown
            size={20}
            className="shrink-0 text-muted transition-transform"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        )}
      </span>
    </span>
  );

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      {expandable ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="block w-full">
          {inner}
        </button>
      ) : (
        inner
      )}
      {toggle}
      {expandable && open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

// The two "what if Jamie's pay came out of this too?" pills — small enough to
// sit right next to the profit number instead of hiding behind its tap, since
// they change the number rather than just explain it. Same radio behavior as
// before: pick one, or neither; clicking the picked one clears back to neither.
function JamieToggle({
  jamieCut,
  setJamieCut,
  jamiePay,
  jamieDistributions,
}: {
  jamieCut: "none" | "pay" | "dist";
  setJamieCut: React.Dispatch<React.SetStateAction<"none" | "pay" | "dist">>;
  jamiePay: number | null;
  jamieDistributions: number | undefined;
}) {
  const pills: Array<{
    key: "pay" | "dist";
    label: string;
    disabled: boolean;
    title: string;
  }> = [
    {
      key: "pay",
      label: "Include Jamie's Pay",
      // `!jamiePay`, not `== null`: a period Jamie earned nothing in has
      // nothing to subtract either, and a pill that lights up and moves no
      // number reads as broken.
      disabled: !jamiePay,
      title:
        jamiePay == null
          ? "Couldn't reach the gym dashboard for this period."
          : !jamiePay
            ? "The gym dashboard has no pay recorded for this period."
            : "Subtracts what the gym dashboard's pay model says Jamie earned. Replaces the full-distributions cut — the earned pay is already part of it.",
    },
    {
      key: "dist",
      label: "Include all Jamie's Distributions",
      disabled: !jamieDistributions,
      title:
        "Subtracts everything drawn from Jamie's distribution tree — Taycan, Equinox, Charges, Transfers, Car Insurance. Already includes the earned pay, so it replaces that cut.",
    },
  ];

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setJamieCut((v) => (v === p.key ? "none" : p.key))}
          disabled={p.disabled}
          title={p.title}
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40"
          style={
            jamieCut === p.key
              ? { background: "var(--good)", borderColor: "var(--good)", color: "#fff" }
              : { borderColor: "var(--muted)", color: "var(--muted)" }
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// The categories behind Total Revenue or Total Expenses — each one opens to
// its own accounts and, from there, the exact transactions. Same two-level
// drill-down as every other breakdown on this page (LineRow).
function CategoryList({
  lines,
  positive,
  untagged,
}: {
  lines: ScheduleCLine[];
  positive?: boolean;
  untagged?: number;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  if (lines.length === 0) {
    return <p className="text-[13px] text-muted">Nothing here for this stretch of time.</p>;
  }

  return (
    <>
      <ul className="space-y-1">
        {lines.map((l) => (
          <LineRow key={l.code} line={l} open={open.has(l.code)} onToggle={() => toggle(l.code)} good={positive} />
        ))}
      </ul>
      {!!untagged && (
        <p className="text-[12px] text-muted">
          Some of the total isn&apos;t sorted into a category yet, so these add up to less than the number above.
        </p>
      )}
    </>
  );
}

// "11/27/24 to 8/14/26 · 22 months", or "March 2026", or "2025". The one line
// that says WHICH stretch of time the number above it covers — previously the
// job of a separate card two scrolls away from the figure it described.
function TimeSpan({
  year,
  month,
  range,
  throughDate,
}: {
  year: number | "all-time";
  month?: number;
  range?: { start: string; end: string };
  throughDate: string | null;
}) {
  if (month && typeof year === "number") return <>{`${MONTHS[month - 1]} ${year}`}</>;
  if (year !== "all-time") {
    return <>{throughDate ? `${year}, up to ${shortDate(throughDate)}` : String(year)}</>;
  }
  const from = range?.start;
  const to = throughDate;
  // Counted off the real dates rather than a fixed start, so a year Chris
  // hasn't shared shortens this line instead of being quietly claimed.
  const months =
    from && to
      ? (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
        (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) +
        1
      : null;
  if (!from || !to) return <>Everything Chris has shared</>;
  return (
    <>
      {shortDate(from)} to {shortDate(to)}
      {months ? ` · ${months} months` : ""}
    </>
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
  /** Where the button goes — the toggle flipped, same cut underneath. A link
   *  rather than local state, because the toggle lives in the URL (see the
   *  note on `readClean`) and the two must never disagree about which
   *  numbers are showing. */
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
//
// FALLBACK ONLY — prefer `line.accounts`, which Money App computes per ledger
// line. This function can't: `accountPath` names only ONE account per
// transaction (whichever line was biggest), so every Stripe payout — one
// deposit carrying memberships, guest passes, product sales and chargebacks —
// gets filed whole under its largest line. That read Guest Passes as $105 of a
// real $1,775.50 and buried a -$2,153 of Chargebacks inside Recurring
// Memberships, with the category totals still correct the whole time, which is
// what made it look like a filtering bug for so long. Kept because the two apps
// deploy separately and a Money App that predates `accounts` should degrade to
// a rough grouping rather than an empty one.
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
  // Money App's own per-account split when it sends one, and only fall back to
  // inferring it from the transaction list when it doesn't. The two disagree
  // whenever a transaction is split across accounts — see `groupByAccount`.
  const groups = line.accounts?.length
    ? line.accounts.map((a) => ({
        account: accountLeaf(a.path),
        total: a.amount,
        txs: a.transactions ?? [],
      }))
    : groupByAccount(txs);
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
