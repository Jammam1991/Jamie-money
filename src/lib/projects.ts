// ── Projects: the things Jamie is working on that aren't a bill ─────────────
// Career, the divorce, the partnership agreement, the roach problem… each one
// is a little folder of its own: where it stands, the steps, what's happened so
// far, who's involved, what it costs, the numbers worth keeping, and links.
//
// The whole list is one JSON row in `settings` (key "projects"), same as Cars
// and Home Buying, so there's no table to create. This file is shared by the
// server and the browser — the shapes, the starter list, and the one cleaner
// every save and every read goes through.

import { PAGES } from "./pages";

export const PROJECT_STATUSES = [
  "Not started",
  "Working on it",
  "Waiting on someone",
  "Done",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectStep = {
  id: string;
  text: string;
  done: boolean;
  /** ISO date it needs doing by, or null. */
  due: string | null;
};

// A dated line in the project's diary — "Called the landlord, they said…".
// Worth keeping even when nothing changed: for the roach problem or the rent
// help, a written record of who said what and when is the evidence.
export type ProjectUpdate = {
  id: string;
  date: string;
  text: string;
};

export type ProjectPerson = {
  id: string;
  name: string;
  /** What they are to this project — "Lawyer", "Landlord", "Caseworker". */
  role: string;
  phone: string;
  email: string;
  notes: string;
};

// "cost" is money going out (a filing fee, the lawyer); "in" is money coming
// back (the rent help itself, a refund). `settled` is paid / received.
export type MoneyKind = "cost" | "in";

export type ProjectMoney = {
  id: string;
  label: string;
  amount: number;
  kind: MoneyKind;
  settled: boolean;
  date: string | null;
};

// The numbers and facts that get asked for over and over — a case number, an
// application ID, the unit number, the new name exactly as it'll be spelled.
export type ProjectDetail = {
  id: string;
  label: string;
  value: string;
};

export type ProjectLink = {
  id: string;
  label: string;
  url: string;
};

export type Project = {
  id: string;
  name: string;
  emoji: string;
  status: ProjectStatus;
  /** What "finished" looks like, in his own words. */
  goal: string;
  nextStep: string;
  deadline: string | null;
  notes: string;
  /** A page in this app that goes with it — Career and Divorce have their own. */
  pageHref: string | null;
  steps: ProjectStep[];
  updates: ProjectUpdate[];
  people: ProjectPerson[];
  money: ProjectMoney[];
  details: ProjectDetail[];
  links: ProjectLink[];
  /** "legal" files it under Legal instead of Projects — a case, a lawyer, a dispute. */
  area: "legal" | null;
  /** Stamped by the server on every save. Null on a starter nobody's touched. */
  updatedAt: string | null;
};

export const MAX_PROJECTS = 60;

// The quick picks on the project editor. Anything else can be typed.
export const PROJECT_EMOJIS = [
  "💼", "⚖️", "🤝", "🪳", "🏠", "🪪", "📋", "💰",
  "🚗", "🏥", "📚", "✈️", "🐶", "🔧", "📦", "⭐",
];

// What the list starts as, before anything's been saved. Fixed ids, so the
// first save of any one of them writes all six — the server slots the edited
// one back into this same list rather than starting from nothing.
function starter(id: string, name: string, emoji: string, pageHref: string | null = null): Project {
  return {
    id,
    name,
    emoji,
    status: "Working on it",
    goal: "",
    nextStep: "",
    deadline: null,
    notes: "",
    pageHref,
    steps: [],
    updates: [],
    people: [],
    money: [],
    details: [],
    links: [],
    area: null,
    updatedAt: null,
  };
}

export const STARTER_PROJECTS: Project[] = [
  starter("starter-career", "Career", "💼", "/career"),
  starter("starter-divorce", "Divorce", "⚖️", "/divorce"),
  starter("starter-partnership", "Business Partnership Agreement", "🤝"),
  starter("starter-roaches", "Roach Issue", "🪳"),
  starter("starter-rent-help", "Glendale Rent Assistance", "🏠"),
  starter("starter-name-change", "Name Change", "🪪"),
];

export function blankProject(name: string, emoji: string): Project {
  return { ...starter(newId(), name, emoji), status: "Not started" };
}

// The facts every legal matter gets asked for, ready to fill in — and the
// lawyer as the first person on it, if he knows who that is yet.
export const LEGAL_DETAIL_LABELS = [
  "Law firm",
  "Case number",
  "Court",
  "Other side",
  "Retainer / fee deal",
];

export function blankLegalMatter(name: string, firm: string, lawyer: string): Project {
  const p = blankProject(name, "⚖️");
  return {
    ...p,
    area: "legal",
    status: "Working on it",
    details: LEGAL_DETAIL_LABELS.map((label) => ({
      id: newId(),
      label,
      value: label === "Law firm" ? firm.trim() : "",
    })),
    people: lawyer.trim()
      ? [{ id: newId(), name: lawyer.trim(), role: firm.trim() ? `Attorney, ${firm.trim()}` : "Attorney", phone: "", email: "", notes: "" }]
      : [],
  };
}

export function isLegal(p: Project): boolean {
  return p.area === "legal";
}

export function detailValue(p: Project, label: string): string {
  return p.details.find((d) => d.label.toLowerCase() === label.toLowerCase())?.value ?? "";
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── The cleaner ──────────────────────────────────────────────────────────────
// Every read and every save goes through this, so a hand-edited row, an old
// shape, or a crafted request can't put anything odd on the screen. Links in
// particular: only http(s) gets through, so nothing typed can become a
// `javascript:` link.

const PAGE_HREFS = new Set(PAGES.map((p) => p.href));

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const dateOrNull = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

const idOf = (v: unknown) => str(v, 60) || newId();

const list = <T>(v: unknown, max: number, each: (row: Record<string, unknown>) => T | null): T[] =>
  Array.isArray(v)
    ? v
        .slice(0, max)
        .map((row) => (row && typeof row === "object" ? each(row as Record<string, unknown>) : null))
        .filter((row): row is T => row !== null)
    : [];

export function cleanUrl(v: unknown): string {
  const raw = str(v, 1000);
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export function cleanProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const status = PROJECT_STATUSES.includes(p.status as ProjectStatus)
    ? (p.status as ProjectStatus)
    : "Working on it";
  const href = str(p.pageHref, 100);
  return {
    id: idOf(p.id),
    name: str(p.name, 120) || "Untitled project",
    emoji: str(p.emoji, 16) || "📋",
    status,
    goal: str(p.goal, 1000),
    nextStep: str(p.nextStep, 300),
    deadline: dateOrNull(p.deadline),
    notes: str(p.notes, 10000),
    pageHref: PAGE_HREFS.has(href) ? href : null,
    steps: list(p.steps, 200, (s) => {
      const text = str(s.text, 300);
      return text ? { id: idOf(s.id), text, done: s.done === true, due: dateOrNull(s.due) } : null;
    }),
    updates: list(p.updates, 500, (u) => {
      const text = str(u.text, 3000);
      const date = dateOrNull(u.date);
      return text && date ? { id: idOf(u.id), date, text } : null;
    }),
    people: list(p.people, 60, (r) => {
      const name = str(r.name, 120);
      return name
        ? {
            id: idOf(r.id),
            name,
            role: str(r.role, 120),
            phone: str(r.phone, 40),
            email: str(r.email, 200),
            notes: str(r.notes, 1000),
          }
        : null;
    }),
    money: list(p.money, 300, (m) => {
      const label = str(m.label, 200);
      const n = Math.abs(Number(m.amount));
      if (!label || !Number.isFinite(n)) return null;
      return {
        id: idOf(m.id),
        label,
        amount: Math.round(Math.min(n, 10_000_000) * 100) / 100,
        kind: m.kind === "in" ? "in" : "cost",
        settled: m.settled === true,
        date: dateOrNull(m.date),
      };
    }),
    details: list(p.details, 100, (d) => {
      const label = str(d.label, 120);
      return label ? { id: idOf(d.id), label, value: str(d.value, 1000) } : null;
    }),
    links: list(p.links, 100, (l) => {
      const url = cleanUrl(l.url);
      return url ? { id: idOf(l.id), label: str(l.label, 200) || url, url } : null;
    }),
    area: p.area === "legal" ? "legal" : null,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt.slice(0, 40) : null,
  };
}

export function parseProjects(raw: unknown): Project[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const row of raw.slice(0, MAX_PROJECTS)) {
    const p = cleanProject(row);
    // Two rows with one id would make every save land on the first of them.
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

// ── What the screens show ────────────────────────────────────────────────────

export function stepProgress(p: Project): { done: number; total: number } {
  return { done: p.steps.filter((s) => s.done).length, total: p.steps.length };
}

// The soonest date still ahead of him on this project — the deadline, or an
// unfinished step with a date on it. Overdue ones count too: those are the
// ones that most need seeing.
export function nextDate(p: Project): { date: string; what: string } | null {
  const dates: { date: string; what: string }[] = [];
  if (p.deadline && p.status !== "Done") dates.push({ date: p.deadline, what: "Deadline" });
  for (const s of p.steps) if (!s.done && s.due) dates.push({ date: s.due, what: s.text });
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates[0] ?? null;
}

export function moneyTotals(p: Project): {
  costs: number;
  stillToPay: number;
  comingIn: number;
  stillToCome: number;
} {
  let costs = 0;
  let stillToPay = 0;
  let comingIn = 0;
  let stillToCome = 0;
  for (const m of p.money) {
    if (m.kind === "cost") {
      costs += m.amount;
      if (!m.settled) stillToPay += m.amount;
    } else {
      comingIn += m.amount;
      if (!m.settled) stillToCome += m.amount;
    }
  }
  return { costs, stillToPay, comingIn, stillToCome };
}

// Whole days from `today` to `iso`, both "YYYY-MM-DD". Negative = past.
export function daysUntil(iso: string, today: string): number {
  const ms = Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
