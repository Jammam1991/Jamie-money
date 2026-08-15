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

import type { Rollup } from "@/lib/businessFinances";

export type ViewModeId = "full" | "operating" | "seller" | "cpa" | "clean";

export type ViewMode = {
  id: ViewModeId;
  /** The button. */
  label: string;
  /** The line under the button — what this cut leaves out, in plain words. */
  blurb: string;
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
  /** Read the `noMistakes` cut that comes down in the same response. */
  noMistakes: boolean;
  /** Lead with the Schedule C lines instead of the month-by-month strip. */
  taxLayout: boolean;
};

export const VIEW_MODES: ViewMode[] = [
  {
    id: "full",
    label: "The full picture",
    blurb: "Every dollar in and out, exactly as it happened.",
    profitTitle: "Made a profit",
    lossTitle: "Lost money",
    tag: "",
    operational: false,
    slim: false,
    noMistakes: false,
    taxLayout: false,
  },
  {
    id: "operating",
    label: "Operating profit only",
    blurb:
      "How the gym did on its own. Leaves out grant money, loan interest, depreciation and tax payments.",
    profitTitle: "The gym made a profit on its own",
    lossTitle: "The gym lost money on its own",
    tag: "gym's own numbers",
    operational: true,
    slim: false,
    noMistakes: false,
    taxLayout: false,
  },
  {
    id: "seller",
    label: "Seller view — what a buyer would see",
    blurb: "Leaves out the one-off spending a new owner wouldn't be taking on.",
    profitTitle: "Profit a buyer would see",
    lossTitle: "Loss a buyer would see",
    tag: "buyer's view",
    operational: false,
    slim: true,
    noMistakes: false,
    taxLayout: false,
  },
  {
    id: "cpa",
    label: "CPA view — for taxes",
    blurb: "The same money, sorted into the boxes on the tax return.",
    profitTitle: "Profit the tax return starts from",
    lossTitle: "Loss the tax return starts from",
    tag: "tax view",
    operational: false,
    slim: false,
    noMistakes: false,
    taxLayout: true,
  },
  {
    id: "clean",
    label: "The full picture, minus our mistakes",
    blurb: "Everything, with the start-up mistakes Chris marked taken back out.",
    profitTitle: "Profit without the mistakes",
    lossTitle: "Loss without the mistakes",
    tag: "mistakes taken out",
    operational: false,
    slim: false,
    noMistakes: true,
    taxLayout: false,
  },
];

/**
 * What the page opens on.
 *
 * Deliberately NOT "full": this is the figure Jamie has been reading since the
 * page shipped, and it's the one Chris picked to line up with the Operating
 * Profit tile on his own dashboard. Changing the default would silently move
 * the headline number for someone who never touched the selector.
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
  // to "seller", and `?operational=false` was the switch that predates the
  // selector entirely. Both still land where they meant to.
  if (sp.view === "slim") return "seller";
  if (sp.operational === "false") return "full";
  return DEFAULT_VIEW_MODE;
}

export type Headline = { moneyIn: number; moneyOut: number; profit: number };

/**
 * Money in, money out and what's left — read the way this mode means them.
 *
 * Two shapes, not five. "Operating profit only" is the odd one out: it reads
 * the roll-up's own `operatingProfit`, which has grant income and loan
 * interest carved off BOTH sides. Every other mode is showing the whole
 * picture, so grant money counts as money in and loan interest counts as
 * money out, and the bottom line is `netProfit`.
 *
 * Both shapes are arithmetic on figures Money App already computed, so
 * `moneyIn - moneyOut` always equals `profit` exactly — no rounding drift
 * between the big number and the two tiles under it.
 */
export function headlineFor(rollup: Rollup, mode: ViewMode): Headline {
  if (mode.operational) {
    return {
      moneyIn: rollup.income,
      moneyOut: rollup.cogs + rollup.expenses,
      profit: rollup.operatingProfit,
    };
  }
  // `financeCharges` is optional here for the usual reason (see the note on
  // Rollup): a Money App that predates it sends nothing, and treating that as
  // zero costs a line of interest rather than the whole page.
  return {
    moneyIn: rollup.income + rollup.otherIncome,
    moneyOut: rollup.cogs + rollup.expenses + (rollup.financeCharges ?? 0),
    profit: rollup.netProfit,
  };
}
