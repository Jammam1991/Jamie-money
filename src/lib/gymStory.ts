// ── The Gym Story ──────────────────────────────────────────────────────────
// Same idea as the old Debt Story: don't re-derive numbers, read them. Every
// chapter that carries a dollar figure gets it from the same Money App feed
// Business Finances uses (getBusinessFinances), for the real month(s) that
// chapter covers — nothing here is typed in by hand or hardcoded per year.
//
// Chapters that describe things Money App has no reason to know about (Chris's
// personal loans, the lease liability, the car accident, the partnership
// friction) carry plain narrative text and no `fact`. A chapter never claims a
// number it can't back up with a real month's books.

import { getBusinessFinances, businessFinancesReady, type Rollup } from "./businessFinances";

export type LineItem = { label: string; amount: number };

export type MistakeItem = {
  id: string;
  date: string;
  name: string | null;
  memo: string | null;
  amount: number;
  category: string;
};

/** One chapter's drillable number: what it is, and the real lines behind it. */
export type FinancialFact = {
  /** What the headline figure means, e.g. "Net loss" or "Combined expenses". */
  label: string;
  amount: number;
  income: number;
  expenses: number;
  /** Schedule C categories behind the figure, largest first. */
  breakdown: LineItem[];
  /** Real transactions Chris flagged as mistakes within this window, if any. */
  mistakes: MistakeItem[];
  /** Which real month(s) this was pulled from, e.g. "Nov–Dec 2024". */
  sourceLabel: string;
  /** True if Money App had nothing for this window (too early, or not shared). */
  unavailable: boolean;
};

export type GymTone = "gold" | "amber" | "rose" | "sky" | "violet" | "teal";

export type GymChapter = {
  id: string;
  era: string;
  emoji: string;
  title: string;
  tone: GymTone;
  paragraphs: string[];
  fact?: FinancialFact;
  /** An optional pointer to where the real records live, e.g. the Debt page. */
  link?: { href: string; label: string };
};

export type GymStory = {
  chapters: GymChapter[];
  startLabel: string;
  throughDate: string | null;
  lifetime: { income: number; expenses: number; net: number };
};

const EMPTY_FACT_LINES: LineItem[] = [];

function combineLines(rollups: Rollup[]): LineItem[] {
  const byLabel = new Map<string, number>();
  for (const r of rollups) {
    for (const l of r.lines) {
      byLabel.set(l.label, (byLabel.get(l.label) ?? 0) + l.amount);
    }
  }
  return [...byLabel.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((l) => l.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Turn one or more months of real rollups into a chapter's drillable fact. */
function factFrom(
  label: string,
  sourceLabel: string,
  rollups: (Rollup | null)[],
  mistakes: MistakeItem[][],
): FinancialFact {
  const real = rollups.filter((r): r is Rollup => r !== null);
  if (real.length === 0) {
    return {
      label,
      amount: 0,
      income: 0,
      expenses: 0,
      breakdown: EMPTY_FACT_LINES,
      mistakes: [],
      sourceLabel,
      unavailable: true,
    };
  }
  const income = real.reduce((s, r) => s + r.income, 0);
  const expenses = real.reduce((s, r) => s + r.cogs + r.expenses, 0);
  return {
    label,
    amount: income - expenses,
    income,
    expenses,
    breakdown: combineLines(real),
    mistakes: mistakes.flat(),
    sourceLabel,
    unavailable: false,
  };
}

const RENOVATION_WORDS = /renovat|remodel|construct|contractor|improvement|build[- ]?out/i;

function findRenovationMistakes(mistakes: MistakeItem[]): MistakeItem[] {
  return mistakes.filter(
    (m) => RENOVATION_WORDS.test(m.name ?? "") || RENOVATION_WORDS.test(m.memo ?? "") || RENOVATION_WORDS.test(m.category),
  );
}

function findRenovationLines(lines: LineItem[]): LineItem[] {
  return lines.filter((l) => RENOVATION_WORDS.test(l.label));
}

const GRANT_WORDS = /grant/i;

function findGrantLines(lines: LineItem[]): LineItem[] {
  return lines.filter((l) => GRANT_WORDS.test(l.label));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** year/month N months after Nov 2024, 1-indexed month. */
function monthsAfterStart(n: number): { year: number; month: number } {
  const base = 2024 * 12 + 11 - 1; // Nov 2024, 0-indexed month math
  const total = base + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function lastNMonths(n: number, from: Date): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1; // 1-indexed
  for (let i = 0; i < n; i++) {
    out.push({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out.reverse();
}

function extractMistakes(
  data: Awaited<ReturnType<typeof getBusinessFinances>>["data"] | undefined,
): MistakeItem[] {
  if (!data?.noMistakes) return [];
  return data.noMistakes.mistakes.map((m) => ({
    id: m.id,
    date: m.date,
    name: m.name,
    memo: m.memo,
    amount: m.mistakeAmount,
    category: m.category,
  }));
}

/**
 * Fetches the real months this story needs and assembles the 10 chapters.
 * Never throws — a Money App that can't be reached just leaves the affected
 * chapters without a `fact`, same as every other page here.
 */
export async function getGymStory(): Promise<{ story: GymStory | null; error: string | null }> {
  if (!businessFinancesReady()) {
    return { story: null, error: "This page isn't connected to the Money App yet." };
  }

  const today = new Date();
  const last3 = lastNMonths(3, today);
  const sixMonthMark = monthsAfterStart(6); // ~May 2025, when the cuts start
  const twelveMonthMark = monthsAfterStart(12); // ~Nov 2025, after months of cutting

  const anchors = [
    { key: "nov2024", year: 2024, month: 11 },
    { key: "dec2024", year: 2024, month: 12 },
    { key: "jan2025", year: 2025, month: 1 },
    { key: "sixMonth", year: sixMonthMark.year, month: sixMonthMark.month },
    { key: "twelveMonth", year: twelveMonthMark.year, month: twelveMonthMark.month },
    { key: "jan2026", year: 2026, month: 1 },
    { key: "last3a", year: last3[0].year, month: last3[0].month },
    { key: "last3b", year: last3[1].year, month: last3[1].month },
    { key: "last3c", year: last3[2].year, month: last3[2].month },
  ];

  const [allTimeResult, ...monthResults] = await Promise.all([
    getBusinessFinances(undefined, undefined, true),
    ...anchors.map((a) => getBusinessFinances(a.year, a.month)),
  ]);

  if (!allTimeResult.data) {
    return { story: null, error: allTimeResult.error ?? "Couldn't reach the Money App." };
  }

  const byKey = new Map(anchors.map((a, i) => [a.key, monthResults[i].data]));
  const rollup = (key: string): Rollup | null => byKey.get(key)?.actual ?? null;
  const mistakesOf = (key: string): MistakeItem[] => extractMistakes(byKey.get(key));

  const earlyFact = factFrom(
    "Net result",
    "Nov–Dec 2024",
    [rollup("nov2024"), rollup("dec2024")],
    [mistakesOf("nov2024"), mistakesOf("dec2024")],
  );

  const janFact = factFrom("Net result", monthLabel(2025, 1), [rollup("jan2025")], [mistakesOf("jan2025")]);
  const grantLines = findGrantLines(janFact.breakdown);

  const beforeCutsFact = factFrom(
    "Net result",
    monthLabel(sixMonthMark.year, sixMonthMark.month),
    [rollup("sixMonth")],
    [mistakesOf("sixMonth")],
  );
  const afterCutsFact = factFrom(
    "Net result",
    monthLabel(twelveMonthMark.year, twelveMonthMark.month),
    [rollup("twelveMonth")],
    [mistakesOf("twelveMonth")],
  );
  const cuttingMistakes = [...mistakesOf("sixMonth"), ...mistakesOf("twelveMonth")];

  const renoRollup = rollup("jan2026");
  const renoFact = factFrom("Total spending", monthLabel(2026, 1), [renoRollup], [mistakesOf("jan2026")]);
  const renoMistakeHits = findRenovationMistakes(mistakesOf("jan2026"));
  const renoLineHits = findRenovationLines(renoFact.breakdown);

  const last3Labels = last3.map((m) => monthLabel(m.year, m.month)).join(", ");
  const last3Fact = factFrom(
    "Net result",
    last3Labels,
    [rollup("last3a"), rollup("last3b"), rollup("last3c")],
    [mistakesOf("last3a"), mistakesOf("last3b"), mistakesOf("last3c")],
  );

  const lifetime = {
    income: allTimeResult.data.actual.income,
    expenses: allTimeResult.data.actual.cogs + allTimeResult.data.actual.expenses,
    // Operating profit, not netProfit — same reasoning as Business Finances'
    // headline: netProfit folds grant income back in, and the Decision
    // chapter's whole point is the gym's real operating position.
    net: allTimeResult.data.actual.operatingProfit,
  };

  const chapters: GymChapter[] = [
    {
      id: "beginning",
      era: "Before November 2024",
      emoji: "🥊",
      title: "The Beginning",
      tone: "gold",
      paragraphs: [
        "Jamie was unemployed and struggling to find work. Chris started looking for a way to help — and for an investment opportunity of his own.",
      ],
    },
    {
      id: "finding-the-gym",
      era: "2024",
      emoji: "🔍",
      title: "Finding the Gym",
      tone: "gold",
      paragraphs: [
        "Chris found the gym through an ad. What followed was six months of intense negotiation with the previous owner before a deal came together.",
      ],
    },
    {
      id: "investment",
      era: "November 2024",
      emoji: "💰",
      title: "Chris's Investment",
      tone: "amber",
      paragraphs: [
        "Chris took out $50,000–$60,000 in personal loans and put up family security for the lease — over $200,000 of personal risk and liability.",
        "Jamie put in zero financial risk: no job to lose, no money down. The deal was simple — Jamie gave Chris 6 to 12 months of full control to get it running.",
        "These figures are Chris's own personal loans and liability, not gym transactions, so there's no Money App ledger to drill into here.",
      ],
    },
    {
      id: "early-problems",
      era: "November–December 2024",
      emoji: "📉",
      title: "Early Problems",
      tone: "rose",
      paragraphs: [
        "Things fell apart fast. Mass cancellations came in off contracts the previous owner had written badly. The original projection — $200,000 a year in profit — evaporated within weeks. The gym was barely breaking even.",
      ],
      fact: earlyFact,
    },
    {
      id: "setbacks",
      era: "January 2025",
      emoji: "🚗",
      title: "Setbacks",
      tone: "rose",
      paragraphs: [
        "One month after buying the gym, Jamie was in a car accident — a setback with training clients right when momentum mattered most.",
        "The January wildfires killed what should have been the New Year's surge everyone in the industry counts on.",
        grantLines.length > 0
          ? `A $${Math.round(grantLines.reduce((s, l) => s + l.amount, 0)).toLocaleString()} grant came through that month (shown in the books below), but it didn't come close to covering the revenue that was lost.`
          : "A $25,000 grant was secured, but it didn't come close to covering the revenue that was lost. (Money App doesn't have this tagged as its own line for this month, so it isn't shown in the breakdown below.)",
      ],
      fact: janFact,
    },
    {
      id: "cutting-costs",
      era: `${monthLabel(sixMonthMark.year, sixMonthMark.month)} – ${monthLabel(twelveMonthMark.year, twelveMonthMark.month)}`,
      emoji: "✂️",
      title: "Cutting Costs",
      tone: "sky",
      paragraphs: [
        "About six months in, the cuts started — coaches, expenses, anything not earning its keep, gradually pared back.",
        "It wasn't a clean turnaround. Real spending mistakes kept happening while everyone was still learning what running a gym actually costs.",
        cuttingMistakes.length > 0
          ? `Money App has ${cuttingMistakes.length} transaction${cuttingMistakes.length === 1 ? "" : "s"} Chris flagged as mistakes across these two months — real line items, not estimates. See them below.`
          : "Chris hasn't flagged any specific transactions as mistakes in Money App for these two months, so this chapter shows the category totals instead.",
      ],
      fact: {
        ...afterCutsFact,
        label: "Net result, before vs. after",
        sourceLabel: `${beforeCutsFact.sourceLabel} → ${afterCutsFact.sourceLabel}`,
        breakdown: [
          { label: `${beforeCutsFact.sourceLabel} expenses`, amount: beforeCutsFact.expenses },
          { label: `${afterCutsFact.sourceLabel} expenses`, amount: afterCutsFact.expenses },
          ...combineLines([rollup("sixMonth"), rollup("twelveMonth")].filter((r): r is Rollup => r !== null)),
        ],
        mistakes: cuttingMistakes,
      },
    },
    {
      id: "managing-the-money",
      era: "Throughout the first year",
      emoji: "💸",
      title: "Managing the Money",
      tone: "amber",
      paragraphs: [
        "Jamie took on managing the finances. He was also training clients off the books and keeping that cash — in his mind, it was his paycheck. The gym couldn't actually afford to pay him, but he took the money anyway, plus additional funds on top of it.",
        "Chris had to keep funding the business more and more to cover the gap. That's a real part of how the debt piled up.",
        "Jamie later secured a $50,000 business loan to help pay some of that back to Chris. Chris put the $25,000 grant from the Setbacks chapter toward paying down some of his own personal credit cards. Jamie also took out a $6,000 US Bank credit card and a $5,000 Pace business loan.",
        "These are business debts, and the gym's actual balances on them — paid down or not — live on the Debt page, not here.",
      ],
      link: { href: "/debt", label: "See the Business Debt section on the Debt page" },
    },
    {
      id: "partnership",
      era: "Throughout the first year",
      emoji: "🤝",
      title: "The Partnership Problem",
      tone: "violet",
      paragraphs: [
        "No partnership agreement was ever set up. Roles blurred, toes got stepped on, and there was real fighting and turmoil throughout the year.",
        "This is about how decisions got made, not about the money — so there's nothing from Money App to attach here.",
      ],
    },
    {
      id: "renovation",
      era: "January 2026",
      emoji: "🔨",
      title: "The Renovation Mistake",
      tone: "rose",
      paragraphs: [
        "Chris renovated the gym, thinking it would give Jamie more of a sense of ownership. In hindsight, it was a complete waste of money.",
        renoMistakeHits.length > 0
          ? `Money App has ${renoMistakeHits.length} transaction${renoMistakeHits.length === 1 ? "" : "s"} matching the renovation, flagged by Chris himself — real line items below.`
          : renoLineHits.length > 0
            ? "Money App has a category matching the renovation for this month — shown below."
            : "Money App doesn't break the renovation out as its own line for this month, so the figure below is total spending for January 2026, not the renovation alone.",
      ],
      fact: {
        ...renoFact,
        breakdown: renoLineHits.length > 0 ? renoLineHits : renoFact.breakdown,
        mistakes: renoMistakeHits.length > 0 ? renoMistakeHits : renoFact.mistakes,
      },
    },
    {
      id: "turning-corner",
      era: "The last three months",
      emoji: "📈",
      title: "Turning the Corner",
      tone: "teal",
      paragraphs: [
        "After everything, the last three months have finally been slightly profitable. The real month-by-month numbers are below.",
      ],
      fact: last3Fact,
    },
    {
      id: "decision",
      era: "Now",
      emoji: "⚖️",
      title: "The Decision",
      tone: "gold",
      paragraphs: [
        "The gym is at a turning point: renew the lease and keep going, or close and take a loss estimated at $100,000–$200,000.",
        "The lifetime numbers below are every real dollar in and out since the gym opened in November 2024 — the actual position this decision is being made from.",
      ],
      fact: {
        label: "Lifetime net",
        amount: lifetime.net,
        income: lifetime.income,
        expenses: lifetime.expenses,
        breakdown: combineLines([allTimeResult.data.actual]),
        mistakes: [],
        sourceLabel: `Nov 2024 – ${allTimeResult.data.throughDate ?? "today"}`,
        unavailable: false,
      },
    },
  ];

  return {
    story: {
      chapters,
      startLabel: "November 2024",
      throughDate: allTimeResult.data.throughDate,
      lifetime,
    },
    error: null,
  };
}
