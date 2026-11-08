// ── Legal: copy the cases over from the Money App, once ─────────────────────
// Chris keeps his legal cases in the Money App (Projects › Lawyers & Cases) and
// most of them are joint (Chris, 2026-11-07: "Add all the legal cases from my
// money app to Jamie's since most are the same (joint)"). This reads them from
// the Money App's /api/legal/export and files each one under Legal here, with
// its lawyers as people and its call log as the diary.
//
// Once, not a sync: after the copy, Jamie's matters are his to edit, and a
// second copy would undo his edits. A "legal_import" row in `settings` records
// that it ran. Until the Money App has the export (it's a separate deploy) the
// attempt is retried at most once an hour.
//
// Nothing about the cases lives in this repo's code — it's public — only the
// shape they're turned into.

import { client, getProjects, PROJECTS_KEY } from "./store";
import { apiUrl, moneyAppReady } from "./moneyapp";
import { LEGAL_DETAIL_LABELS, newId, parseProjects, type Project, type ProjectStatus } from "./projects";

const IMPORT_KEY = "legal_import";
const RETRY_MS = 60 * 60 * 1000;

type MaCase = {
  id: string;
  title: string;
  status: string;
  case_number: string | null;
  court: string | null;
  other_side: string | null;
  next_date: string | null;
  next_what: string | null;
  notes: string | null;
};
type MaLawyer = {
  name: string;
  firm: string | null;
  specialty: string | null;
  status: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  rate: string | null;
  retainer: number | null;
  notes: string | null;
  case_ids: string[];
};
type MaLog = {
  case_id: string | null;
  kind: string;
  happened_on: string;
  summary: string;
  details: string | null;
  amount: number | null;
};

const STATUS: Record<string, ProjectStatus> = {
  not_started: "Not started",
  active: "Working on it",
  waiting: "Waiting on someone",
  on_hold: "Not started",
  closed: "Done",
};

const LAWYER_STATUS: Record<string, string> = {
  considering: "thinking about",
  consulted: "talked to",
  hired: "hired",
  done: "finished with",
  declined: "said no",
};

const LOG_KIND: Record<string, string> = {
  call_out: "Called them",
  call_in: "They called",
  voicemail: "Left a voicemail",
  email: "Email",
  text: "Text",
  meeting: "Meeting",
  court: "Court",
  document: "Papers",
  payment: "Paid",
  note: "Note",
};

function emojiFor(title: string): string {
  if (/name/i.test(title)) return "🪪";
  if (/estate|will|trust/i.test(title)) return "📋";
  if (/evict|landlord|rent/i.test(title)) return "🏠";
  return "⚖️";
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function toMatter(c: MaCase, lawyers: MaLawyer[], logs: MaLog[], existing: Project | undefined): Project {
  const mine = lawyers.filter((l) => l.case_ids.includes(c.id));
  const firm = mine.find((l) => l.firm)?.firm ?? "";
  const retainer = mine.find((l) => l.retainer)?.retainer ?? null;
  const facts: Record<string, string> = {
    "Law firm": firm,
    "Case number": c.case_number ?? "",
    Court: c.court ?? "",
    "Other side": c.other_side ?? "",
    "Retainer / fee deal": [retainer ? `$${retainer.toLocaleString("en-US")} retainer` : "", mine.find((l) => l.rate)?.rate ?? ""]
      .filter(Boolean)
      .join(" · "),
  };

  const base: Project = existing ?? {
    id: `ma-legal-${c.id}`,
    name: c.title,
    emoji: emojiFor(c.title),
    status: STATUS[c.status] ?? "Working on it",
    goal: "",
    nextStep: c.status === "on_hold" ? "On hold for now" : "",
    deadline: null,
    notes: "",
    pageHref: null,
    steps: [],
    updates: [],
    people: [],
    money: [],
    details: [],
    links: [],
    area: "legal",
    updatedAt: null,
  };

  // Anything already filled in here wins; the Money App only fills the gaps.
  const details = [...base.details];
  for (const label of LEGAL_DETAIL_LABELS) {
    const at = details.findIndex((d) => sameName(d.label, label));
    if (at === -1) details.push({ id: newId(), label, value: facts[label] ?? "" });
    else if (!details[at].value && facts[label]) details[at] = { ...details[at], value: facts[label] };
  }

  const people = [...base.people];
  for (const l of mine) {
    if (people.some((p) => sameName(p.name, l.name))) continue;
    const role = [l.specialty ? `${l.specialty} lawyer` : "Lawyer", LAWYER_STATUS[l.status]].filter(Boolean).join(" — ");
    people.push({
      id: newId(),
      name: l.name,
      role,
      phone: l.phone ?? "",
      email: l.email ?? "",
      notes: [l.website, l.notes].filter(Boolean).join("\n"),
    });
  }

  const updates = [...base.updates];
  for (const g of logs.filter((x) => x.case_id === c.id)) {
    const text = [`${LOG_KIND[g.kind] ?? "Note"}: ${g.summary}`, g.details].filter(Boolean).join(" — ");
    if (updates.some((u) => u.date === g.happened_on && u.text === text)) continue;
    updates.push({ id: newId(), date: g.happened_on, text });
  }

  const steps = [...base.steps];
  if (c.next_date && c.next_what && !steps.some((s) => sameName(s.text, c.next_what as string))) {
    steps.push({ id: newId(), text: c.next_what, done: false, due: c.next_date });
  }

  return {
    ...base,
    area: "legal",
    notes: base.notes || c.notes || "",
    details,
    people,
    updates,
    steps,
  };
}

/** Copy the Money App's legal cases in, if that hasn't happened yet. Never throws. */
export async function importMoneyAppLegalOnce(): Promise<void> {
  try {
    const c = client();
    const base = apiUrl();
    const key = process.env.MONEYAPP_API_KEY;
    if (!c || !base || !key || !moneyAppReady()) return;

    const { data: flag } = await c.from("settings").select("value").eq("key", IMPORT_KEY).maybeSingle();
    if (flag?.value) {
      try {
        const f = JSON.parse(String(flag.value)) as { done?: boolean; tried?: number };
        if (f.done || (f.tried && Date.now() - f.tried < RETRY_MS)) return;
      } catch {
        return;
      }
    }
    const mark = (value: object) =>
      c.from("settings").upsert({ key: IMPORT_KEY, value: JSON.stringify(value) }, { onConflict: "key" });

    const res = await fetch(`${base.replace(/\/$/, "")}/api/legal/export`, {
      headers: { "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      await mark({ done: false, tried: Date.now(), status: res.status });
      return;
    }
    const data = (await res.json()) as { cases?: MaCase[]; lawyers?: MaLawyer[]; logs?: MaLog[] };
    const cases = Array.isArray(data.cases) ? data.cases : [];
    const lawyers = Array.isArray(data.lawyers) ? data.lawyers : [];
    const logs = Array.isArray(data.logs) ? data.logs : [];

    const current = await getProjects();
    if (!current) return; // couldn't read — try again next time, nothing written
    const list = [...current];
    for (const ca of cases) {
      if (!ca?.id || !ca.title) continue;
      // Already copied, or the same thing already here under its name (the
      // starter Divorce and Name Change projects) — upgrade that one in place
      // rather than showing it twice.
      const at = list.findIndex((p) => p.id === `ma-legal-${ca.id}` || sameName(p.name, ca.title));
      const matter = toMatter(ca, lawyers, logs, at === -1 ? undefined : list[at]);
      if (at === -1) list.push(matter);
      else list[at] = matter;
    }
    const cleaned = parseProjects(list);
    const { error } = await c
      .from("settings")
      .upsert({ key: PROJECTS_KEY, value: JSON.stringify(cleaned) }, { onConflict: "key" });
    if (error) return;
    await mark({ done: true, at: new Date().toISOString(), cases: cases.length });
  } catch {
    // A quiet Money App just means no copy this time.
  }
}
