// ── The list of pages Chris can park as "Coming Soon" for Jamie ───────────────
// One place that names every screen Jamie can reach, so the page gates and the
// Settings screen never drift apart. The links themselves never move — a parked
// page still opens, it just shows a placeholder instead of its content.
// Home ("/") isn't here on purpose — it always shows its real content.

export type PageKey =
  | "bills"
  | "debt"
  | "owes"
  | "compare"
  | "job-vs-business"
  | "career"
  | "credit-report"
  | "business-finances"
  | "tax-center"
  | "divorce"
  | "married-vs-divorce"
  | "gym-story"
  | "big-picture";

export interface AppPage {
  key: PageKey;
  href: string;
  label: string;
  // Where the link shows up, so the Settings screen can group them.
  where: "nav" | "home" | "menu";
  // A plain-words line under the toggle.
  blurb: string;
}

export const PAGES: AppPage[] = [
  {
    key: "bills",
    href: "/bills",
    label: "Bills",
    where: "nav",
    blurb: "What's due this month and what's paid.",
  },
  {
    key: "debt",
    href: "/debt",
    label: "My Debt",
    where: "nav",
    blurb: "Jamie's card and loan balances.",
  },
  {
    key: "owes",
    href: "/owes",
    label: "Past Due",
    where: "nav",
    blurb: "Money owed to Chris.",
  },
  {
    key: "compare",
    href: "/compare",
    label: "Job vs Business (quick look)",
    where: "home",
    blurb: "The short pay comparison, opened from the home screen card.",
  },
  {
    key: "job-vs-business",
    href: "/job-vs-business",
    label: "Job vs Business",
    where: "menu",
    blurb: "The full write-up: pros, cons, job leads, journal.",
  },
  {
    key: "career",
    href: "/career",
    label: "Career",
    where: "menu",
    blurb:
      "Weighing up career paths, the jobs applied for and the resumes sent, and who's worth knowing.",
  },
  {
    key: "credit-report",
    href: "/credit-report",
    label: "Credit Report",
    where: "menu",
    blurb: "Uploaded reports and the credit-score history.",
  },
  {
    key: "business-finances",
    href: "/business-finances",
    label: "Business Finances",
    where: "menu",
    // Parking it here hides the whole page. WHAT it shows when it's on is set
    // in the Money App instead — Settings → Shared access, on this app's row.
    blurb: "The gym's P&L, from the Money App. What's on it is set over there.",
  },
  {
    key: "tax-center",
    href: "/tax-center",
    label: "Tax Center",
    where: "menu",
    blurb: "Taxes paid and refunds by year, from the Money App, plus the return documents.",
  },
  {
    key: "divorce",
    href: "/divorce",
    label: "Divorce",
    where: "menu",
    blurb: "Support, the split, benefits, key dates.",
  },
  {
    key: "married-vs-divorce",
    href: "/married-vs-divorce",
    label: "Married vs Divorce",
    where: "menu",
    blurb:
      "What staying married is worth in dollars, and why the guarantees aren't about the marriage.",
  },
  {
    key: "gym-story",
    href: "/gym-story",
    label: "Gym Story",
    where: "menu",
    blurb: "How the gym started, backed by the real numbers from Money App.",
  },
  {
    key: "big-picture",
    href: "/big-picture",
    label: "The Big Picture",
    where: "menu",
    // The one page that shows Jamie Chris's side of the ledger as well as his
    // own — every debt across the household, and the credit left to draw on.
    blurb:
      "The whole household: all our debt, the monthly gap, and how much credit is left.",
  },
];

// Where each page is reached from — just a heading on the Settings screen.
export const WHERE_LABELS: Record<AppPage["where"], string> = {
  nav: "Bottom tabs",
  home: "Home screen",
  menu: "Menu (☰)",
};
