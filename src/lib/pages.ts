// ── Every screen Jamie can reach, and where its link lives ────────────────────
// One list, so the bottom bar, the slide-out menu and the Settings screen can
// never drift apart: a page can't appear in the app without being here, and one
// taken out of here disappears everywhere at once.
//
// `slots` is only the starting point. Chris moves a page between the bottom bar
// and the menu on the Settings screen, and that choice is saved — see
// navLayout.ts, which is what actually decides where each link renders.

import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Building2,
  Car,
  Compass,
  CreditCard,
  Dumbbell,
  FileText,
  HeartHandshake,
  Home,
  KeyRound,
  Landmark,
  Receipt,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type PageKey =
  | "home"
  | "bills"
  | "debt"
  | "owes"
  | "compare"
  | "job-vs-business"
  | "career"
  | "credit-report"
  | "home-buying"
  | "cars"
  | "business-finances"
  | "tax-center"
  | "gym-story"
  | "gym-lease"
  | "big-picture"
  | "story"
  | "divorce"
  | "married-vs-divorce";

// The three places a link can sit. "history" is the collapsible group inside the
// menu — still the menu, one level down.
export type Slot = "nav" | "menu" | "history";

export const SLOTS: Slot[] = ["nav", "menu", "history"];

export const SLOT_LABELS: Record<Slot, string> = {
  nav: "Bottom bar",
  menu: "Menu",
  history: "Menu › History",
};

export interface AppPage {
  key: PageKey;
  href: string;
  label: string;
  Icon: LucideIcon;
  // Where the link sits until Chris moves it. A page can be in more than one
  // place at once — My Debt is a bottom tab and a menu row today.
  slots: Slot[];
  // A plain-words line under the row on the Settings screen.
  blurb: string;
  // My Cash only: always the first tab, never moved, never hidden. Without one
  // pinned tab the bottom bar could be emptied and the app would have no way
  // back to the home screen.
  fixed?: boolean;
  // Also a card on the home screen, under the cash box.
  homeCard?: boolean;
}

// The bottom bar on a phone. Five is what fits before the labels start
// wrapping — My Cash plus four.
export const MAX_NAV_TABS = 5;

export const PAGES: AppPage[] = [
  {
    key: "home",
    href: "/",
    label: "My Cash",
    Icon: Home,
    slots: ["nav"],
    fixed: true,
    blurb: "The home screen. Always the first tab.",
  },
  {
    key: "bills",
    href: "/bills",
    label: "Bills",
    Icon: Receipt,
    slots: ["nav"],
    blurb: "What's due this month and what's paid.",
  },
  {
    key: "debt",
    href: "/debt",
    label: "My Debt",
    Icon: CreditCard,
    slots: ["nav", "menu"],
    blurb: "Jamie's card and loan balances.",
  },
  {
    key: "owes",
    href: "/owes",
    label: "Past Due",
    Icon: AlertCircle,
    slots: ["nav"],
    blurb:
      "Money owed to Chris. The tab only appears when something is actually late.",
  },
  {
    key: "compare",
    href: "/compare",
    label: "Job vs Business (quick look)",
    Icon: Scale,
    slots: [],
    homeCard: true,
    blurb: "The short pay comparison, opened from the home screen card.",
  },
  {
    key: "job-vs-business",
    href: "/job-vs-business",
    label: "Job vs Business",
    Icon: Scale,
    slots: ["menu"],
    blurb: "The full write-up: pros, cons, job leads, journal.",
  },
  {
    key: "career",
    href: "/career",
    label: "Career",
    Icon: Briefcase,
    slots: ["menu"],
    blurb:
      "Weighing up career paths, the jobs applied for and the resumes sent, and who's worth knowing.",
  },
  {
    key: "credit-report",
    href: "/credit-report",
    label: "Credit Report",
    Icon: FileText,
    slots: ["menu"],
    blurb: "Uploaded reports and the credit-score history.",
  },
  {
    key: "home-buying",
    href: "/home-buying",
    label: "Home Buying",
    Icon: Home,
    slots: ["menu"],
    blurb:
      "What massage income could buy: the biggest mortgage and house a lender would allow.",
  },
  {
    key: "cars",
    href: "/cars",
    label: "Cars",
    Icon: Car,
    slots: ["menu"],
    blurb:
      "The Taycan's loan, mileage, insurance and warranty, plus what came before it.",
  },
  {
    key: "business-finances",
    href: "/business-finances",
    label: "Business Finances",
    Icon: Building2,
    slots: ["menu"],
    // Hiding it here takes the whole page away. WHAT it shows when it's on is
    // set in the Money App instead — Settings → Shared access, on this app's row.
    blurb: "The gym's P&L, from the Money App. What's on it is set over there.",
  },
  {
    key: "tax-center",
    href: "/tax-center",
    label: "Tax Center",
    Icon: Landmark,
    slots: ["menu"],
    blurb:
      "Taxes paid and refunds by year, from the Money App, plus the return documents.",
  },
  {
    key: "gym-story",
    href: "/gym-story",
    label: "Gym Story",
    Icon: Dumbbell,
    slots: ["menu"],
    blurb: "How the gym started, backed by the real numbers from Money App.",
  },
  {
    key: "gym-lease",
    href: "/gym-lease",
    label: "Gym Lease",
    Icon: KeyRound,
    slots: ["menu"],
    blurb: "The current lease terms, and what's being shopped to replace it.",
  },
  {
    key: "big-picture",
    href: "/big-picture",
    label: "The Big Picture",
    Icon: Compass,
    slots: ["history"],
    // The one page that shows Jamie Chris's side of the ledger as well as his
    // own — every debt across the household, and the credit left to draw on.
    blurb:
      "The whole household: all our debt, the monthly gap, and how much credit is left.",
  },
  {
    key: "story",
    href: "/story",
    label: "The Debt Story",
    Icon: BookOpen,
    slots: ["history"],
    blurb: "The settlement written out, handed over to the Money App version.",
  },
  {
    key: "divorce",
    href: "/divorce",
    label: "Divorce",
    Icon: Scale,
    slots: ["history"],
    blurb: "Support, the split, benefits, key dates.",
  },
  {
    key: "married-vs-divorce",
    href: "/married-vs-divorce",
    label: "Married vs Divorce",
    Icon: HeartHandshake,
    slots: ["history"],
    blurb:
      "What staying married is worth in dollars, and why the guarantees aren't about the marriage.",
  },
];

// The order links come out in, one list per place.
//
// It can't be read off PAGES above, because a page in two places wants a
// different neighbour in each: My Debt is the third bottom tab, after Bills,
// and the third menu row, after Career. So each place says its own order.
//
// A page missing from a list still shows — it just follows on the end, in the
// order it appears in PAGES. Whoever's looking can then drag the menu into any
// order they like on top of this; this is only where it starts.
export const SLOT_ORDER: Record<Slot, PageKey[]> = {
  nav: ["home", "bills", "debt", "owes"],
  menu: [
    "job-vs-business",
    "career",
    "debt",
    "credit-report",
    "home-buying",
    "cars",
    "business-finances",
    "tax-center",
    "gym-story",
    "gym-lease",
  ],
  history: ["big-picture", "story", "divorce", "married-vs-divorce"],
};

const BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

export function pageByKey(key: string): AppPage | undefined {
  return BY_KEY.get(key as PageKey);
}

export function isPageKey(key: string): key is PageKey {
  return BY_KEY.has(key as PageKey);
}

export function isSlot(value: string): value is Slot {
  return SLOTS.includes(value as Slot);
}
