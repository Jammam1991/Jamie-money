// ── Spending history, 2017 to today ───────────────────────────────────────────
// Rebuilt 08/04/2026 from Chris's Divorce.xlsx (6 tabs), after pulling out
// $15,046 of rows that were entered twice or counted on two different tabs.
// Split on the real dates Chris confirmed: married 07/01/2020, separated
// 10/16/2021 (the day the Ruby apartment was rented).
//
// ── Why this section is admin-only ───────────────────────────────────────────
// Only about a third of the total has a bank record behind it. The rest was
// reconstructed from memory, and $27.5k of it has neither a date nor a receipt.
// It's working material for Chris and his lawyer. It is NOT a settled balance,
// and it shouldn't go in front of Jamie until the Berkshire HELOC statement
// closes the gaps below.

export const SPENDING = {
  marriedOn: "07/01/2020",
  separatedOn: "10/16/2021",
  separatedNote: "the day the Ruby apartment was rented",
  rebuiltOn: "08/04/2026",

  // Rows removed from the source sheet before any of this was added up:
  // six duplicated lines on the 2017-2023 tab, plus five items that appeared
  // on both the "Chris Loan" tab and the bank export.
  duplicatesRemoved: 15_046.49,

  // The Berkshire HELOC that consolidated the 2019-2023 borrowing. This is the
  // container the older debts were poured into — NOT a separate debt to stack
  // on top of the itemised list. Counting both would double the claim.
  helocTotal: 212_000,
  helocCovers: "2019–2023",

  // What the itemised list actually accounts for over the same span.
  itemisedThrough2023: 122_639.87,
} as const;

export interface Period {
  key: string;
  emoji: string;
  when: string;
  title: string;
  amount: number;
  items: number;
  accent: string;
  bg: string;
  note: string;
}

// The three chapters, plus the undated pile that can't be placed on the timeline.
export const PERIODS: Period[] = [
  {
    key: "pre",
    emoji: "👤",
    when: "2017 – Jun 2020",
    title: "Before the marriage",
    amount: 29_114.62,
    items: 80,
    accent: "var(--reg)",
    bg: "var(--reg-bg)",
    note: "Boston years, the 2019 road trip, early card payoffs and the Land Rover.",
  },
  {
    key: "married",
    emoji: "💍",
    when: "Jul 2020 – Oct 2021",
    title: "Married and together",
    amount: 51_391.29,
    items: 56,
    accent: "var(--fico)",
    bg: "var(--fico-bg)",
    note: "Fifteen months. The Rolexes ($11.5k), IRS 2020 taxes, rent, Miami, Vegas.",
  },
  {
    key: "post",
    emoji: "🚪",
    when: "Oct 2021 – today",
    title: "After the separation",
    amount: 124_489.68,
    items: 207,
    accent: "var(--warn)",
    bg: "var(--warn-bg)",
    note: "Includes the $27.5k of undated items, which are almost all 2024-25.",
  },
];

// How solid each slice of the total actually is. This is the part a lawyer
// reads first, so it gets equal billing with the total itself.
export interface Evidence {
  label: string;
  amount: number;
  items: number;
  color: string;
  note: string;
}

export const EVIDENCE: Evidence[] = [
  {
    label: "Bank records behind it",
    amount: 60_035.32,
    items: 235,
    color: "var(--good)",
    note: "Statement lines with a real date. This is the part that holds up.",
  },
  {
    label: "Rebuilt from memory",
    amount: 117_426.29,
    items: 93,
    color: "#fbbf24",
    note: "Mostly 2017-2023. Dates are month or year placeholders, not real ones.",
  },
  {
    label: "No date, no receipt",
    amount: 27_533.98,
    items: 11,
    color: "#dc2626",
    note: "Taycan $12.7k, Berkshire $4.5k, “Amex stolen” $4k, vet bills.",
  },
];

// The subset that is both post-separation AND has a bank record behind it —
// the strongest version of the claim, and the one worth leading with.
export const STRONGEST = {
  amount: 57_139.7,
  items: 169,
} as const;

export const OPEN_ITEMS: { emoji: string; title: string; detail: string }[] = [
  {
    emoji: "📄",
    title: "Get the Berkshire HELOC closing statement",
    detail:
      "It lists every account the $212k paid off, by name and amount. One document turns the spotty 2017-2023 records into bank-documented ones. Highest-value piece of paper in the whole file.",
  },
  {
    emoji: "🕳️",
    title: "The $89,360 gap",
    detail:
      "The HELOC was $212,000. The itemised list only accounts for $122,640 over the same years. Either it also rolled in Chris's own pre-Jamie debt, or ~$89k of real spending was never written down.",
  },
  {
    emoji: "📈",
    title: "HELOC interest was never counted",
    detail:
      "The sheet carries one line — “Birkshire (approx payments) $4,500”. Interest on $212k runs roughly $17k a year, and none of it is in the total.",
  },
  {
    emoji: "🗓️",
    title: "The dates on the older half are placeholders",
    detail:
      "Most 2017-2023 entries are stamped to the 1st of a month, or just a year. They're estimates, and they should be described that way.",
  },
  {
    emoji: "🧮",
    title: "$15,046 of duplicates already pulled out",
    detail:
      "The Affirm loans, Vegas table, Bloomingdales and CIS payment were each entered twice; four more items were on both the Chris Loan tab and the bank export. Worth knowing before anyone re-adds the original sheet.",
  },
];

export const periodTotal = PERIODS.reduce((sum, p) => sum + p.amount, 0);
export const periodMax = Math.max(...PERIODS.map((p) => p.amount));
export const evidenceTotal = EVIDENCE.reduce((sum, e) => sum + e.amount, 0);
