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
// with a link across instead of a second copy. The one business figure it
// does carry (`businessChapters`) isn't a gym number at all — it's the slice
// of Chris and Jamie's PERSONAL debt that the gym caused, which Money App
// has no way to know about.

export type MoneyStoryBasis = "measured" | "estimated" | "tbd";

export type MoneyStoryLine = {
  label: string;
  amount: number;
  /**
   * How this line's total splits, for rows where the split is the point —
   * the year-by-year payment history. Both together or neither: half a split
   * would invite the reader to work out the other half and be wrong.
   */
  interest?: number;
  everythingElse?: number;
};

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
  /** The personal chapters — personal money only, no business in them. */
  chapters: MoneyStoryChapter[];
  /**
   * The business chapters, kept in their own array rather than mixed into
   * `chapters`, so a personal figure never quietly includes gym money. Split
   * out on 2026-09-09: the $440,000 for 2023–now used to carry the Boxing RX
   * line inside it, which made the personal spending read worse than it was.
   */
  businessChapters: MoneyStoryChapter[];
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
        paragraphs: [
          "Something shifted. This sits on top of the $212,000 from 2017–2022.",
          "Personal money only. What went into Boxing RX happened in these same years, but it's counted on its own further down.",
        ],
        fact: {
          label: "Added in new personal debt",
          amount: 325000,
          basis: "estimated",
          note: "Chris's own reconstruction from bank statements.",
          breakdown: [
            { label: "Rolexes, trips, and many purchases", amount: 0 },
            { label: "Almost a year of rent (~$40,000)", amount: 0 },
            { label: "Jamie borrowed more than he earned from massage", amount: 0 },
          ],
          breakdownNote:
            "This used to read $440,000, with Boxing RX inside it. The gym's $115,000 now has its own section below — same total, told straight.",
        },
      },
      {
        id: "debt-today",
        era: "Today",
        title: "The debt, added up",
        tone: "rose",
        paragraphs: ["Everything above, plus the gym section below, added together."],
        fact: {
          label: "Total debt today",
          amount: 650000,
          basis: "estimated",
          note: "Personal and business together, rounded.",
          breakdown: [
            { label: "2017–2022 — building a life", amount: 212000 },
            { label: "2023–now — personal", amount: 325000 },
            { label: "2025–2027 — the gym (below)", amount: 115000 },
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
        era: "2019 – Sept 2026",
        title: "What Chris has paid, over the years",
        tone: "teal",
        paragraphs: [
          "7 years, 8 months. Cash out of Chris's personal accounts — a floor figure, not the full picture; the real total is likely somewhat higher. Jamie paid nothing toward this, except some of his own credit cards, tracked separately.",
        ],
        fact: {
          label: "Total paid toward debt",
          amount: 870299,
          basis: "measured",
          note: "The eight years below, added up — not a rounded guess.",
          breakdown: [
            { label: "2019", amount: 39275, interest: 484, everythingElse: 38791 },
            { label: "2020", amount: 118965, interest: 702, everythingElse: 118263 },
            { label: "2021", amount: 85150, interest: 87, everythingElse: 85063 },
            { label: "2022", amount: 128266, interest: 298, everythingElse: 127968 },
            { label: "2023", amount: 109417, interest: 702, everythingElse: 108715 },
            { label: "2024", amount: 115730, interest: 12853, everythingElse: 102877 },
            { label: "2025", amount: 214942, interest: 26453, everythingElse: 188489 },
            { label: "2026 (to Sep 4)", amount: 58554, interest: 14687, everythingElse: 43867 },
          ],
          breakdownNote:
            "$56,266 of interest, $814,033 of everything else. \"Everything else\" is not the same as principal — it's whatever wasn't booked as interest, so it still holds interest that was never labelled. That's why 2019–2023 look almost interest-free and 2024 onward doesn't. 2026 is a part year, nine months.",
        },
      },
    ],
    businessChapters: [
      {
        id: "business-debt",
        era: "2025 – 2027",
        title: "The gym's share of the debt",
        tone: "gold",
        paragraphs: [
          "This part isn't personal spending at all — it's Boxing RX. It used to be folded into the personal number above, which made the personal side look worse than it was.",
          "Not counted here: the family security Chris put up for the lease — over $200,000 of liability that only turns into real money owed if the gym fails.",
        ],
        fact: {
          label: "Personal debt taken on for the business",
          amount: 115000,
          basis: "estimated",
          note: "Taken out of the 2023–now figure above, not added on top.",
          breakdown: [
            { label: "Personal loans Chris took to buy into the gym", amount: 56000 },
            { label: "Jamie's owner draws, beyond what the gym could afford", amount: 58539 },
          ],
          breakdownNote:
            "The buy-in loans came in November 2024, right before these years — Chris put them at $50,000–$60,000. The draws figure is measured. Together, rounded to $115,000.",
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
        explain:
          "Roughly $27,600 Chris covered for Jamie in 2026, plus $2,541 in gifts, spread over 12 months.",
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
