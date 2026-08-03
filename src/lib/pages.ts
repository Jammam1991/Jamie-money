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
  | "overall-debt"
  | "credit-report"
  | "divorce"
  | "divorce-responsibility";

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
    key: "overall-debt",
    href: "/overall-debt",
    label: "Overall Debt",
    where: "menu",
    blurb: "Everything owed and owned between both of you.",
  },
  {
    key: "credit-report",
    href: "/credit-report",
    label: "Credit Report",
    where: "menu",
    blurb: "Uploaded reports and the credit-score history.",
  },
  {
    key: "divorce",
    href: "/divorce",
    label: "Divorce",
    where: "menu",
    blurb: "Support, the split, benefits, key dates.",
  },
  {
    key: "divorce-responsibility",
    href: "/divorce-responsibility",
    label: "The Debt Story",
    where: "menu",
    blurb: "How the debt got here, and what Jamie's share works out to.",
  },
];

// Where each page is reached from — just a heading on the Settings screen.
export const WHERE_LABELS: Record<AppPage["where"], string> = {
  nav: "Bottom tabs",
  home: "Home screen",
  menu: "Menu (☰)",
};
