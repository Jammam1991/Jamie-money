// ── Jamie's Google Calendar on the home screen ──────────────────────────────
// Read through the calendar's "secret address in iCal format" — a private link
// Google gives every calendar. Jamie pastes it once and it keeps working: no
// Google sign-in, no app to approve, and none of the weekly expiry a Google
// login grant has while an app is unverified. The link is kept server-side in
// `settings` and never sent back to the browser.
//
// The feed is the standard .ics format. This reads just enough of it for a
// "what's coming up" list: one-off events, all-day events, time zones, and the
// usual repeats (daily / weekly on certain days / monthly / yearly), with the
// skipped and moved occurrences Google writes alongside them.

export type CalEvent = {
  id: string;
  title: string;
  /** ISO timestamp. For an all-day event, midnight Pacific that day. */
  start: string;
  end: string | null;
  allDay: boolean;
  location: string;
};

export const HOME_TZ = "America/Los_Angeles";

// Only calendar services' own hosts — the server fetches this link, so it
// shouldn't be pointable at anything else.
const ALLOWED_HOSTS = [
  /^calendar\.google\.com$/,
  /^p\d+-caldav\.icloud\.com$/,
  /^outlook\.(office365|live)\.com$/,
];

/** The cleaned https link, or null if it isn't a calendar feed we accept. */
export function cleanCalendarLink(raw: string): string | null {
  const text = raw.trim().replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.some((h) => h.test(url.hostname))) return null;
  return url.toString();
}

// ── Time zones ───────────────────────────────────────────────────────────────

type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };

function validTz(tz: string | undefined): string {
  if (!tz) return HOME_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return HOME_TZ;
  }
}

// How far ahead of UTC the zone's clocks are at this instant, in ms.
function tzOffset(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// A clock time in a zone → the real instant. Checked twice so a time on the
// far side of a daylight-saving change still lands on the right hour.
function wallToMs(w: Wall, tz: string): number {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  let ms = guess - tzOffset(guess, tz);
  ms = guess - tzOffset(ms, tz);
  return ms;
}

function msToWall(ms: number): Wall {
  const d = new Date(ms);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
  };
}

// Wall-clock arithmetic, done as if the clock were UTC so no DST gets in.
function addDays(w: Wall, n: number): Wall {
  return msToWall(Date.UTC(w.y, w.m - 1, w.d + n, w.h, w.mi, w.s));
}
function addMonths(w: Wall, n: number): Wall | null {
  const target = new Date(Date.UTC(w.y, w.m - 1 + n, 1));
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth() + 1;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // "The 31st every month" skips the months that don't have one, like Google.
  if (w.d > daysIn) return null;
  return { ...w, y, m };
}
function weekday(w: Wall): number {
  return new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
}

// ── Parsing ──────────────────────────────────────────────────────────────────

type Prop = { value: string; params: Record<string, string> };
type RawEvent = Record<string, Prop[]>;

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function parseBlocks(ics: string): RawEvent[] {
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0; // VALARM etc. nest inside VEVENT; their props aren't the event's
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (line === "END:VEVENT") {
      events.push(cur);
      cur = null;
      continue;
    }
    if (line.startsWith("BEGIN:")) depth++;
    else if (line.startsWith("END:")) depth--;
    if (depth > 0 || line.startsWith("END:")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const [name, ...paramParts] = line.slice(0, colon).split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
    }
    const key = name.toUpperCase();
    (cur[key] ??= []).push({ value: line.slice(colon + 1), params });
  }
  return events;
}

type When = { wall: Wall; tz: string; allDay: boolean; utc: boolean };

function parseWhen(p: Prop | undefined, fallbackTz: string): When | null {
  if (!p) return null;
  const v = p.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
  if (!m) return null;
  const allDay = !m[4];
  return {
    wall: { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) },
    tz: m[7] ? "UTC" : allDay ? HOME_TZ : validTz(p.params.TZID ?? fallbackTz),
    allDay,
    utc: Boolean(m[7]),
  };
}

function whenToMs(w: When): number {
  return w.utc ? Date.UTC(w.wall.y, w.wall.m - 1, w.wall.d, w.wall.h, w.wall.mi, w.wall.s) : wallToMs(w.wall, w.tz);
}

// Every EXDATE (or RECURRENCE-ID) as an instant, comma lists included.
function instants(props: Prop[] | undefined, fallbackTz: string): number[] {
  const out: number[] = [];
  for (const p of props ?? []) {
    for (const value of p.value.split(",")) {
      const w = parseWhen({ value, params: p.params }, fallbackTz);
      if (w) out.push(whenToMs(w));
    }
  }
  return out;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

type Rule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  untilMs: number | null;
  byDay: { n: number; day: number }[];
};

function parseRule(v: string, fallbackTz: string): Rule | null {
  const parts = Object.fromEntries(
    v.split(";").map((kv) => {
      const [k, val] = kv.split("=");
      return [k.toUpperCase(), val ?? ""];
    })
  );
  const freq = parts.FREQ as Rule["freq"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const until = parts.UNTIL ? parseWhen({ value: parts.UNTIL, params: {} }, fallbackTz) : null;
  const byDay = (parts.BYDAY ? parts.BYDAY.split(",") : [])
    .map((code: string) => {
      const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(code.trim());
      if (!m) return null;
      const day = DAY_CODES.indexOf(m[2]);
      return day < 0 ? null : { n: m[1] ? Number(m[1]) : 0, day };
    })
    .filter((x): x is { n: number; day: number } => x !== null);
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    // An all-day UNTIL means "through the end of that day".
    untilMs: until ? whenToMs(until) + (until.allDay ? 86_400_000 - 1 : 0) : null,
    byDay,
  };
}

// The nth given weekday of a month (n < 0 counts from the end), or null.
function nthWeekday(y: number, m: number, day: number, n: number): number | null {
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const matches: number[] = [];
  for (let d = 1; d <= daysIn; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === day) matches.push(d);
  }
  const pick = n > 0 ? matches[n - 1] : matches[matches.length + n];
  return pick ?? null;
}

// Each occurrence's wall-clock start, in order, until `stopMs` or the rule ends.
function* occurrences(start: When, rule: Rule, stopMs: number): Generator<Wall> {
  let emitted = 0;
  const done = (w: Wall) => {
    const ms = start.utc ? Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) : wallToMs(w, start.tz);
    if (rule.untilMs !== null && ms > rule.untilMs) return true;
    if (rule.count !== null && emitted >= rule.count) return true;
    return ms > stopMs;
  };
  const base = start.wall;
  for (let step = 0; step < 5000; step++) {
    let batch: Wall[] = [];
    if (rule.freq === "DAILY") {
      batch = [addDays(base, step * rule.interval)];
    } else if (rule.freq === "WEEKLY") {
      if (rule.byDay.length === 0) {
        batch = [addDays(base, step * 7 * rule.interval)];
      } else {
        // The week (starting Sunday) this step lands in, then each listed day.
        const weekStart = addDays(base, step * 7 * rule.interval - weekday(base));
        batch = rule.byDay
          .map((b) => addDays(weekStart, b.day))
          .sort((a, b) => Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d));
      }
    } else if (rule.freq === "MONTHLY") {
      const month = addMonths({ ...base, d: 1 }, step * rule.interval);
      if (month) {
        if (rule.byDay.length > 0) {
          batch = rule.byDay
            .map((b) => {
              const d = nthWeekday(month.y, month.m, b.day, b.n || 1);
              return d ? { ...month, d } : null;
            })
            .filter((w): w is Wall => w !== null);
        } else {
          const same = addMonths(base, step * rule.interval);
          batch = same ? [same] : [];
        }
      }
    } else {
      const same = addMonths(base, step * 12 * rule.interval);
      batch = same ? [same] : [];
    }
    for (const w of batch) {
      // Nothing before the series' own first date counts.
      if (Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) < Date.UTC(base.y, base.m - 1, base.d, base.h, base.mi)) continue;
      if (done(w)) return;
      emitted++;
      yield w;
    }
  }
}

/** Upcoming events from an .ics feed, soonest first. */
export function eventsFromIcs(
  ics: string,
  opts: { fromMs: number; toMs: number; limit?: number }
): CalEvent[] {
  const calTz = validTz(/X-WR-TIMEZONE:([^\r\n]+)/.exec(ics)?.[1]?.trim());
  const raw = parseBlocks(ics);

  // Moved or cancelled single occurrences of a repeat: uid → the original
  // start of each one, so the repeat skips it and the override stands in.
  const overridden = new Map<string, Set<number>>();
  for (const e of raw) {
    const uid = e.UID?.[0]?.value;
    if (!uid || !e["RECURRENCE-ID"]) continue;
    const set = overridden.get(uid) ?? new Set<number>();
    for (const ms of instants(e["RECURRENCE-ID"], calTz)) set.add(ms);
    overridden.set(uid, set);
  }

  const out: CalEvent[] = [];
  for (const e of raw) {
    if (e.STATUS?.[0]?.value.toUpperCase() === "CANCELLED") continue;
    const start = parseWhen(e.DTSTART?.[0], calTz);
    if (!start) continue;
    const end = parseWhen(e.DTEND?.[0], calTz);
    const startMs = whenToMs(start);
    const lengthMs = end ? Math.max(0, whenToMs(end) - startMs) : start.allDay ? 86_400_000 : 0;
    const uid = e.UID?.[0]?.value ?? `${startMs}`;
    const title = unescapeText(e.SUMMARY?.[0]?.value ?? "") || "(No title)";
    const location = unescapeText(e.LOCATION?.[0]?.value ?? "");

    const push = (ms: number) => {
      if (ms + Math.max(lengthMs, 1) <= opts.fromMs || ms > opts.toMs) return;
      out.push({
        id: `${uid}-${ms}`,
        title,
        start: new Date(ms).toISOString(),
        end: lengthMs ? new Date(ms + lengthMs).toISOString() : null,
        allDay: start.allDay,
        location,
      });
    };

    const ruleText = e.RRULE?.[0]?.value;
    const rule = ruleText && !e["RECURRENCE-ID"] ? parseRule(ruleText, calTz) : null;
    if (!rule) {
      push(startMs);
      continue;
    }
    const skip = new Set([...instants(e.EXDATE, calTz), ...(overridden.get(uid) ?? [])]);
    for (const w of occurrences(start, rule, opts.toMs)) {
      const ms = start.utc ? Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) : wallToMs(w, start.tz);
      if (!skip.has(ms)) push(ms);
    }
  }

  out.sort((a, b) => a.start.localeCompare(b.start) || Number(b.allDay) - Number(a.allDay));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export type CalendarResult =
  | { state: "none" }
  | { state: "ok"; events: CalEvent[] }
  | { state: "error"; message: string };

/** The next two weeks from a feed link, or why they couldn't be read. */
export async function loadCalendar(link: string | null): Promise<CalendarResult> {
  if (!link) return { state: "none" };
  try {
    const res = await fetch(link, {
      signal: AbortSignal.timeout(8000),
      // A few minutes old is fine for "what's coming up", and it keeps every
      // home-screen visit from going all the way to Google.
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return {
        state: "error",
        message:
          res.status === 404 || res.status === 403
            ? "Google turned the calendar link down. It may have been reset — paste the new one."
            : "Google didn't answer just now. It'll try again next time.",
      };
    }
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      return { state: "error", message: "That link isn't a calendar feed. Paste the \"secret address in iCal format\"." };
    }
    const now = Date.now();
    return {
      state: "ok",
      events: eventsFromIcs(text, { fromMs: now, toMs: now + 14 * 86_400_000, limit: 12 }),
    };
  } catch {
    return { state: "error", message: "Google didn't answer just now. It'll try again next time." };
  }
}
