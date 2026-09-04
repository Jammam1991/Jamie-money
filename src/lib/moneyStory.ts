// ── Our Money Story ────────────────────────────────────────────────────────
// The personal chapter of Chris and Jamie's money story: where the joint debt
// came from, who has actually been paying it, and how the monthly cash
// actually moves. Unlike Gym Story (src/lib/gymStory.ts), this doesn't read
// a live Money App feed — every figure here is one Chris worked out by hand
// with Claude, from his own bank statements and the Money App ledger, and
// typed in on 2026-09-04. That's why every fact below carries a `basis`
// instead of a `sourceLabel` pulled from a real month: it says plainly
// whether a number is measured, estimated, or still missing, instead of
// quietly presenting a hand-typed figure as if it were live data (see
// project_story_figures_are_hardcoded_not_db — the lesson from the OLD debt
// story was to be explicit about this, not to avoid hardcoding entirely).
//
// The business half of the story — Boxing RX — already has its own live,
// drillable page at /gym-story, reading real numbers straight from Money
// App. Rebuilding that here would duplicate it and drift, so this page ends
// with a link across instead of a second copy.

export type MoneyStoryBasis = "measured" | "estimated" | "tbd";

export type MoneyStoryLine = { label: string; amount: number };

export type MoneyStoryFact = {
  /** What the headline figure means, e.g. "Added in debt". */
  label: string;
  /** Null when the number is still a TBD Chris needs to fill in. */
  amount: number | null;
  /** How sure this figure is. Shown as a small badge next to the amount. */
  basis: MoneyStoryBasis;
  /** One line of plain-language context under the badge. */
  note: string;
  /** Itemized lines behind the figure, largest first — shown behind a drill. */
  breakdown?: MoneyStoryLine[];
  /** Caption under the breakdown, e.g. whether it's a full list or examples. */
  breakdownNote?: string;
};

export type MoneyStoryTone = "teal" | "amber" | "rose" | "sky" | "violet" | "gold";

export type MoneyStoryChapter = {
  id: string;
  era: string;
  title: string;
  tone: MoneyStoryTone;
  paragraphs: string[];
  /** The chapter's headline number, if it has one. */
  fact?: MoneyStoryFact;
  /** A second, smaller stat next to the headline — e.g. a percentage. */
  secondaryFact?: MoneyStoryFact;
};

/** One step of the cash-flow waterfall — its own layout, not a chapter card. */
export type CashFlowStep = {
  label: string;
  sub?: string;
  amount: number | null;
  basis: MoneyStoryBasis;
  kind: "in" | "out" | "result";
  /** One more line of detail, shown when the step is tapped open. */
  explain: string;
};

export type MoneyStory = {
  chapters: MoneyStoryChapter[];
  cashFlow: CashFlowStep[];
  asOf: string;
};

export function getMoneyStory(): MoneyStory {
  return {
    asOf: "September 4, 2026",
    chapters: [
      {
        id: "2017-2022",
        era: "2017 – 2022",
        title: "Building a life together",
        tone: "teal",
        paragraphs: [
          "The early years of the marriage. Immigration, the move to LA, and the cost of borrowing to cover it all added up.",
        ],
        fact: {
          label: "Added in debt over these years",
          amount: 212000,
          basis: "estimated",
          note: "Chris's own reconstruction from bank statements.",
          breakdown: [
            { label: "Immigration costs (marriage, etc.)", amount: 0 },
            { label: "Relocation to LA", amount: 0 },
            { label: "The cost of borrowing itself", amount: 0 },
          ],
          breakdownNote:
            "Later consolidated into one HELOC loan — $1,873/month, still the payment today.",
        },
      },
      {
        id: "2023-now",
        era: "2023 – now",
        title: "A different pattern",
        tone: "amber",
        paragraphs: ["Something shifted. This sits on top of the $212,000 from 2017–2022."],
        fact: {
          label: "Added in new debt",
          amount: 440000,
          basis: "estimated",
          note: "Chris's own reconstruction from bank statements.",
          breakdown: [
            { label: "Rolexes, trips, and many purchases", amount: 0 },
            { label: "Almost a year of rent (~$40,000)", amount: 0 },
            { label: "Jamie borrowed more than he earned from massage", amount: 0 },
            {
              label: "Investing in Boxing RX, and covering owner draws beyond what the business could support",
              amount: 0,
            },
          ],
        },
      },
      {
        id: "debt-today",
        era: "Today",
        title: "The debt, added up",
        tone: "rose",
        paragraphs: ["The two periods above, added together."],
        fact: {
          label: "Total debt today",
          amount: 650000,
          basis: "estimated",
          note: "Sum of the two periods above.",
          breakdown: [
            { label: "2017–2022", amount: 212000 },
            { label: "2023–now", amount: 440000 },
          ],
        },
      },
      {
        id: "who-pays",
        era: "Since 2019",
        title: "Who's been paying it down",
        tone: "violet",
        paragraphs: [
          "Jamie has covered his own credit cards — even though most of this debt is joint.",
        ],
        fact: {
          label: "Total monthly payment",
          amount: 12000,
          basis: "measured",
          note: "Interest and principal, combined.",
        },
        secondaryFact: {
          label: "Paid by Chris",
          amount: 90,
          basis: "measured",
          note: "As a percent of the $12,000/month total.",
        },
      },
      {
        id: "total-paid",
        era: "2020 – Sept 2026",
        title: "What Chris has paid, over the years",
        tone: "teal",
        paragraphs: [
          "6 years, 8 months. Cash out of Chris's personal accounts — a floor figure, not the full picture; the real total is likely somewhat higher. Jamie paid nothing toward this, except some of his own credit cards, tracked separately.",
        ],
        fact: {
          label: "Total paid toward debt",
          amount: 910000,
          basis: "measured",
          note: "From bank statements and the ledger. Floor figure.",
          breakdown: [
            { label: "Principal", amount: 802000 },
            { label: "Interest — about 12% of every dollar paid", amount: 108000 },
          ],
          breakdownNote:
            "The interest split for 2020–2022 is estimated ($20k–45k range) — only 2023–2026 ($78k) is measured from statements.",
        },
      },
      {
        id: "net-worth",
        era: "Today",
        title: "Where that leaves us",
        tone: "rose",
        paragraphs: [],
        fact: {
          label: "Net worth",
          amount: -350000,
          basis: "estimated",
          note: "Assets ~$300,000 (incl. $75,000 Comerica severance + $25,000 medical lawsuit) minus debt of $650,000.",
        },
      },
      {
        id: "chris-covered",
        era: "2026",
        title: "What Chris covered for Jamie",
        tone: "gold",
        paragraphs: [],
        fact: {
          label: "Total for 2026",
          amount: 27600,
          basis: "estimated",
          note: "Net of a few thousand in PT-cash payments that came back the other way.",
          breakdown: [
            { label: "Earnest Homes payments (5 charges)", amount: 16817 },
            { label: "Paris trip charges", amount: 2204 },
            { label: "Glendale apartment (application + deposit)", amount: 1045 },
            { label: "Car insurance (2 payments)", amount: 946 },
            { label: "Notetaker for Jamie", amount: 849 },
            { label: "Revolut transfers", amount: 845 },
          ],
          breakdownNote: "A few examples, 2026 — not a full list.",
        },
      },
      {
        id: "gifts",
        era: "2026",
        title: "Gifts",
        tone: "sky",
        paragraphs: [],
        fact: {
          label: "Total for 2026",
          amount: 2541,
          basis: "measured",
          note: "From the 2026 books, unverified against statements.",
          breakdown: [
            { label: "Amazon — Garmin watch", amount: 281 },
            { label: "Amazon — massage tables (net of refund)", amount: 258 },
            { label: "Moncler USA", amount: 241 },
            { label: "Alo Yoga", amount: 210 },
            { label: "Amazon — EV charger", amount: 210 },
            { label: "Cash gift", amount: 200 },
          ],
          breakdownNote: "A few examples — not a full list.",
        },
      },
    ],
    cashFlow: [
      {
        label: "Chris earns",
        sub: "Rental + salary",
        amount: 17400,
        basis: "measured",
        kind: "in",
        explain: "Salary (~$13,800/mo) + rental income ($3,600/mo).",
      },
      {
        label: "Personal spending",
        sub: "Taxes, mortgage, property expenses, personal rent, car, etc.",
        amount: null,
        basis: "tbd",
        kind: "out",
        explain: "Not broken out yet — needs a real monthly total from Chris.",
      },
      {
        label: "Personal loan payments & cards",
        amount: 10800,
        basis: "measured",
        kind: "out",
        explain: "90% of the $12,000/month total household debt payment.",
      },
      {
        label: "The personal loan that funded the business",
        amount: null,
        basis: "tbd",
        kind: "out",
        explain: "Not broken out yet — needs a real monthly amount from Chris.",
      },
      {
        label: "Jamie's private loans & gifts",
        sub: "Average",
        amount: 2500,
        basis: "estimated",
        kind: "out",
        explain: "The 2026 totals above (~$27,600 covered + $2,541 gifts) spread over 12 months.",
      },
      {
        label: "Covers the business",
        sub: "When Jamie's distributions outran what it could afford",
        amount: 2900,
        basis: "estimated",
        kind: "out",
        explain: "Roughly Jamie's BoxingRX-era distributions ($58,539) spread over about 20 months.",
      },
      {
        label: "What's left over",
        amount: null,
        basis: "measured",
        kind: "result",
        explain:
          "Negative — it rolls into more personal debt. That's why Chris had to borrow from his dad, and why he can't do that again.",
      },
    ],
  };
}
