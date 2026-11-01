// ── The five ways to look at the gym's year ──────────────────────────────────
// The same books, cut five ways. Nothing here re-does any math: each mode is
// just a set of switches handed to Money App plus the words that say, on
// screen, which cut Jamie is looking at.
//
// That second part is the whole point. Business Finances used to have one
// unlabelled toggle, so the page could quietly disagree with the number on
// Chris's own dashboard and neither of them said why. Now the answer to "why
// don't these match?" is written at the top of the page.
//
// Every mode is "the full picture, minus one thing" — which is what makes them
// explainable in a line each. Whatever a mode leaves out, the books still hold:
// this is display math, and Money App never changes what it stores.

import type { CutBucket, Rollup } from "@/lib/businessFinances";

// "fed" used to be its own mode sitting next to "cpa". It never was a separate
// question: the FED-tagged items are exactly what comes out for the tax view,
// so the picker was offering the same cut twice under two names. They're now
// one mode — see the `cpa` entry below, and `readViewMode` for the old links.
//
// "clean" used to live here too, as a fifth mode standing in for "full, with
// the mistakes taken out". That made the mistakes toggle and the cut picker
// fight over the same switch — turning mistakes off from "just the gym's own
// money" silently dropped you onto the full picture instead, because "clean"
// carried its own operational/slim/noFed of all-false. Whether the mistakes
// are in or out is now an orthogonal question, carried by the `clean` query
// param (see `readClean`) and layered on top of whichever of these four is
// active — so the toggle changes one thing, not two.
export type ViewModeId = "full" | "operating" | "seller" | "cpa";

export type ViewMode = {
  id: ViewModeId;
  /** The button. */
  label: string;
  /** The line under the button — what this cut leaves out, in plain words. */
  blurb: string;
  /** Wording to use instead when Chris has FED hidden from the feed entirely.
   *  The cut is the same; naming what he chose to hide would undo the hiding,
   *  and with nothing FED-tagged reaching the page there'd be no difference to
   *  point at anyway. */
  blurbFedHidden?: string;
  /** Headline wording, so "Made a profit" isn't the answer to five different questions. */
  profitTitle: string;
  lossTitle: string;
  /** Corner tag repeated on every section, so a cut number can't be read as
   *  the raw one just by scrolling past the headline. Empty for the full
   *  picture, which is the raw one. */
  tag: string;
  /** Ask Money App to drop grants, interest, depreciation and tax payments. */
  operational: boolean;
  /** Ask Money App to drop the transactions marked "Remove from P&L". */
  slim: boolean;
  /** Ask Money App to drop the FED-tagged transactions. */
  noFed: boolean;
  /** Lead with the Schedule C lines instead of the month-by-month strip. */
  taxLayout: boolean;
};

export const VIEW_MODES: ViewMode[] = [
  {
    id: "full",
    label: "Everything",
    blurb: "Every dollar in and out, exactly as it happened.",
    profitTitle: "The gym made",
    lossTitle: "The gym lost",
    tag: "",
    operational: false,
    slim: false,
    noFed: false,
    taxLayout: false,
  },
  {
    id: "operating",
    label: "Just the gym's own money",
    blurb: "Leaves out grant money, loan interest and tax payments.",
    profitTitle: "The gym made, on its own",
    lossTitle: "The gym lost, on its own",
    tag: "gym's own money",
    operational: true,
    slim: false,
    noFed: false,
    taxLayout: false,
  },
  {
    id: "seller",
    label: "What a buyer would see",
    blurb: "Leaves out one-off spending a new owner wouldn't take on.",
    profitTitle: "A buyer would see",
    lossTitle: "A buyer would see a loss of",
    tag: "buyer's view",
    operational: false,
    slim: true,
    noFed: false,
    taxLayout: false,
  },
  {
    // The FED cut and the tax cut are one and the same: what Chris tags FED is
    // what comes out for the return, so this mode drops those items AND lays
    // the year out in tax-return lines. They used to be two buttons showing
    // two names for one answer.
    id: "cpa",
    label: "For the tax return",
    blurb: "Sorted into the boxes on the tax return, minus what Chris tagged FED.",
    blurbFedHidden: "Sorted into the boxes on the tax return.",
    profitTitle: "The tax return starts from",
    lossTitle: "The tax return starts from a loss of",
    tag: "tax view",
    operational: false,
    slim: false,
    noFed: true,
    taxLayout: true,
  },
];

/**
 * What the page opens on.
 *
 * Deliberately NOT "full": this is the figure Jamie has been reading since the
 * page shipped, and it's the one Chris picked to line up with the Operating
 * Profit tile on his own dashboard. Changing the default would silently move
 * the headline number for someone who never touched the selector.
 *
 * This was briefly flipped to "full" chasing a Chart of Accounts mismatch. It
 * was the wrong lever — `operational` only ever drops grants, depreciation and
 * the "Taxes paid" tree (see moneyapp's lib/business-operational.ts), never
 * revenue accounts. The real cause was per-account attribution; see the note on
 * `line.accounts` in BusinessFinancesClient.
 */
export const DEFAULT_VIEW_MODE: ViewModeId = "operating";

export const modeById = (id: ViewModeId): ViewMode =>
  VIEW_MODES.find((m) => m.id === id) ?? VIEW_MODES[1];

/**
 * Which cut the URL is asking for.
 *
 * `?operational=false` is the switch this page had before the selector existed
 * — still honored so an old bookmark or a link Chris already sent lands on the
 * mode it used to mean rather than silently on the default.
 */
export function readViewMode(sp: { view?: string; operational?: string }): ViewModeId {
  const asked = VIEW_MODES.find((m) => m.id === sp.view);
  if (asked) return asked.id;
  // `?view=slim` was this mode's name for the few hours before it was renamed
  // to "seller"; `?view=fed` was the FED cut back when it sat next to the tax
  // cut instead of being it; and `?operational=false` was the switch that
  // predates the selector entirely. All three still land where they meant to.
  if (sp.view === "slim") return "seller";
  if (sp.view === "fed") return "cpa";
  // `?view=clean` was the fifth mode this page used to have — always the full
  // picture, mistakes taken out. `readClean` below turns the toggle back on
  // for a link spelled that way, so it lands on the same numbers it always
  // did; this just has to resolve the cut half of it to something real.
  if (sp.view === "clean") return "full";
  if (sp.operational === "false") return "full";
  return DEFAULT_VIEW_MODE;
}

/**
 * Whether "mistakes taken out" is on — independent of which of the four cuts
 * above is selected. Kept apart from `readViewMode` on purpose: the two used
 * to be the same switch (`clean` was a mode, not a toggle), which meant asking
 * to drop the mistakes from "just the gym's own money" silently dropped the
 * operating cut too, since "clean" carried its own all-false operational/
 * slim/noFed. Reading them separately means turning one on can't turn the
 * other off.
 */
export function readClean(sp: { view?: string; clean?: string }): boolean {
  return sp.clean === "1" || sp.view === "clean";
}

/**
 * The mode's own words, with "mistakes taken out" folded into the corner tag
 * when the toggle is on top of it — so the headline can't be read as the
 * untouched cut by anyone who scrolled past the button above it. Only the
 * display strings change; `operational`/`slim`/`noFed`/`taxLayout` pass
 * through untouched; the actual number swap is `noMistakes.rollup` at the
 * call site, chosen the same way under any of the four cuts.
 */
export function displayMode(mode: ViewMode, clean: boolean): ViewMode {
  if (!clean) return mode;
  return {
    ...mode,
    tag: mode.tag ? `${mode.tag} · mistakes taken out` : "mistakes taken out",
  };
}

export type Headline = {
  moneyIn: number;
  /** The cost of RUNNING the gym — loan interest is not in here. */
  moneyOut: number;
  /** Loan interest, as its own step between money out and profit. Zero under
   *  the operating cut, which drops it rather than counting it. */
  interest: number;
  profit: number;
};

/**
 * Money in, money out and what's left — read the way this mode means them.
 *
 * Two shapes, not five. "Operating profit only" is the odd one out: it reads
 * the roll-up's own `operatingProfit`, which has grant income and loan
 * interest carved off BOTH sides. Every other mode is showing the whole
 * picture, so grant money counts as money in and interest still comes off the
 * bottom line — but as its OWN step, not folded into money out.
 *
 * That split is why `moneyOut` stops at running costs. Chris's P&L (Budget)
 * screen does the same thing: its TOTAL EXPENSES tile leaves interest out and
 * subtracts it lower down as Business Fees, so folding it in here made the two
 * apps disagree on "money out" by every dollar of interest the gym has paid —
 * $18,273 over the BoxingRX era — while both were right. Now the tile matches
 * his, and the interest is a line you can see rather than a difference you have
 * to work out.
 *
 * Every shape is arithmetic on figures Money App already computed, so
 * `moneyIn - moneyOut - interest` always equals `profit` exactly — no rounding
 * drift between the big number and the tiles under it.
 */
export function headlineFor(rollup: Rollup, mode: ViewMode): Headline {
  if (mode.operational) {
    return {
      moneyIn: rollup.income,
      moneyOut: rollup.cogs + rollup.expenses,
      interest: 0,
      profit: rollup.operatingProfit,
    };
  }
  // `financeCharges` is optional here for the usual reason (see the note on
  // Rollup): a Money App that predates it sends nothing, and treating that as
  // zero costs a line of interest rather than the whole page.
  return {
    moneyIn: rollup.income + rollup.otherIncome,
    moneyOut: rollup.cogs + rollup.expenses,
    interest: rollup.financeCharges ?? 0,
    profit: rollup.netProfit,
  };
}

/** One reason this cut differs from the others, ready to render. */
export type CutLine = { key: string; label: string; blurb: string; bucket: CutBucket };

const BUCKETS: Array<{
  key: keyof NonNullable<Rollup["cutDetail"]>;
  label: string;
  blurb: string;
  /** Which switch decides whether this cut leaves it out. */
  droppedBy: "operational" | "slim" | "noFed";
}> = [
  {
    key: "grants",
    label: "Grant money",
    blurb: "Money the gym was given, not money it earned.",
    droppedBy: "operational",
  },
  {
    key: "interest",
    label: "Loan interest",
    blurb: "The cost of the borrowing, not the cost of running the gym.",
    droppedBy: "operational",
  },
  {
    key: "nonOperational",
    label: "Depreciation & tax payments",
    blurb: "Paper costs and tax bills, not day-to-day running costs.",
    droppedBy: "operational",
  },
  {
    key: "removedFromPl",
    label: "One-off spending",
    blurb: "Things Chris marked as not carrying over to a new owner.",
    droppedBy: "slim",
  },
  {
    key: "fed",
    label: "FED-tagged items",
    blurb: "Everything carrying Chris's FED tag.",
    droppedBy: "noFed",
  },
];

/**
 * What this cut left out, and what it counted that another cut wouldn't.
 *
 * The four buckets are the same every time — only which SIDE they land on
 * changes with the cut. That's the honest shape of it: nothing is being hidden
 * from Jamie, the same four things are just being counted or not, and both
 * lists get shown so either question is answered without switching modes.
 *
 * Empty buckets drop out. A year with no grant money shouldn't grow a "Grant
 * money — $0" row on every screen.
 */
export function cutLines(
  rollup: Rollup,
  mode: ViewMode,
  // Belt and braces. Money App already refuses to itemize FED when Chris's
  // tick-box hides it — naming what he chose to hide would undo the hiding —
  // so this bucket should arrive empty. Dropping it here too means a Money App
  // that ever forgets can't turn into a leak on this screen.
  opts: { allowFed?: boolean } = {},
): { leftOut: CutLine[]; counted: CutLine[] } {
  const detail = rollup.cutDetail;
  const leftOut: CutLine[] = [];
  const counted: CutLine[] = [];
  if (!detail) return { leftOut, counted };

  for (const b of BUCKETS) {
    if (b.key === "fed" && opts.allowFed === false) continue;
    const bucket = detail[b.key];
    if (!bucket || bucket.items.length === 0) continue;
    const line: CutLine = { key: b.key, label: b.label, blurb: b.blurb, bucket };
    (mode[b.droppedBy] ? leftOut : counted).push(line);
  }
  return { leftOut, counted };
}
