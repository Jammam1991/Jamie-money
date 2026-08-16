// ── Where every link actually renders ────────────────────────────────────────
// The catalog in pages.ts says where each page starts out. Chris then moves
// pages between the bottom bar and the menu on the Settings screen, and takes
// pages off Jamie's screen entirely. This file is where those two things are
// put together into the three lists the nav components render.
//
// Pure functions on purpose — no session reading, no database. The server works
// out who's looking and hands the answers in, and the Settings screen runs the
// exact same code in the browser so what it previews is what Jamie gets.

import {
  MAX_NAV_TABS,
  PAGES,
  SLOT_ORDER,
  isSlot,
  type AppPage,
  type PageKey,
  type Slot,
} from "./pages";

// Chris's saved moves: page key → the places that page shows. Only pages he's
// actually moved are in here; everything else falls back to the catalog.
export type Placements = Record<string, Slot[]>;

// A stored map can be old (a page since deleted) or hand-edited nonsense, so
// every read goes through this rather than being trusted.
export function parsePlacements(raw: unknown): Placements {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Placements = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const slots = value.filter(
      (s): s is Slot => typeof s === "string" && isSlot(s)
    );
    // Each place once, so a duplicated entry can't render the same row twice.
    out[key] = [...new Set(slots)];
  }
  return out;
}

// Where this page shows. A pinned page ignores anything saved — My Cash is the
// way back to the home screen and can't be moved off the bar.
export function slotsFor(page: AppPage, placements: Placements): Slot[] {
  if (page.fixed) return page.slots;
  const saved = placements[page.key];
  return saved ?? page.slots;
}

// A page has to be reachable from somewhere, or it's a screen with no door.
// The home-screen card counts as somewhere.
export function isReachable(page: AppPage, slots: Slot[]): boolean {
  return slots.length > 0 || Boolean(page.homeCard);
}

// Put one place's links in their order. Anything the order doesn't name keeps
// its place from PAGES and follows on the end.
export function orderForSlot(keys: PageKey[], slot: Slot): PageKey[] {
  const rank = SLOT_ORDER[slot];
  const at = (key: PageKey) => {
    const i = rank.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return keys
    .map((key, fallback) => ({ key, fallback }))
    .sort((a, b) => at(a.key) - at(b.key) || a.fallback - b.fallback)
    .map((x) => x.key);
}

export interface NavLayout {
  nav: PageKey[];
  menu: PageKey[];
  history: PageKey[];
}

export function buildLayout(opts: {
  placements: Placements;
  // Pages Chris has taken off Jamie's screen. Already empty when the person
  // looking is Chris himself — he always keeps every link.
  hidden: string[];
  // False when nothing is late, which is the one tab that comes and goes on its
  // own rather than because Chris moved it.
  showPastDue: boolean;
}): NavLayout {
  const { placements, hidden, showPastDue } = opts;
  const gone = new Set(hidden);

  const nav: PageKey[] = [];
  const menu: PageKey[] = [];
  const history: PageKey[] = [];

  for (const page of PAGES) {
    if (gone.has(page.key)) continue;
    if (page.key === "owes" && !showPastDue) continue;
    const slots = slotsFor(page, placements);
    if (slots.includes("nav")) nav.push(page.key);
    if (slots.includes("menu")) menu.push(page.key);
    if (slots.includes("history")) history.push(page.key);
  }

  // A belt-and-braces trim. The Settings screen already refuses to add a sixth
  // tab, but a saved map from before this rule (or two browsers saving at once)
  // shouldn't be able to spill tabs off the edge of a phone.
  return {
    nav: orderForSlot(nav, "nav").slice(0, MAX_NAV_TABS),
    menu: orderForSlot(menu, "menu"),
    history: orderForSlot(history, "history"),
  };
}

// Is this page one of Jamie's home-screen cards right now?
export function showsHomeCard(key: PageKey, hidden: string[]): boolean {
  const page = PAGES.find((p) => p.key === key);
  return Boolean(page?.homeCard) && !hidden.includes(key);
}
