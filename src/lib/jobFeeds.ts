import { moneyRange, type JobHit } from "./jobSearch";

// ── Searching for jobs ───────────────────────────────────────────────────────
// Two free aggregators, asked at the same time and folded into one list.
// Both carry listings syndicated from a lot of boards, which is the closest
// thing available to searching Indeed from inside an app you own.
//
// Keys, all optional — whatever is set gets used, and the page says plainly
// when nothing is:
//   ADZUNA_APP_ID + ADZUNA_APP_KEY   developer.adzuna.com (instant, free)
//   ADZUNA_COUNTRY                   two-letter country, defaults to "us"
//   JOOBLE_API_KEY                   jooble.org/api/about (free, by request)

const TIMEOUT_MS = 12_000;
const PER_FEED = 20;

export interface FeedStatus {
  adzuna: boolean;
  jooble: boolean;
}

export function jobFeedsConfigured(): FeedStatus {
  return {
    adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jooble: Boolean(process.env.JOOBLE_API_KEY),
  };
}

export function anyFeedConfigured(): boolean {
  const s = jobFeedsConfigured();
  return s.adzuna || s.jooble;
}

// A feed that hangs shouldn't hold the whole search up.
async function withTimeout(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const stop = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(input, { ...init, signal: stop, cache: "no-store" });
}

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Descriptions come back as truncated HTML excerpts. Strip the tags so the
// card shows a sentence rather than markup.
function plain(v: unknown, max = 220): string | null {
  const t = str(v);
  if (!t) return null;
  const clean = t
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

async function searchAdzuna(what: string, where: string): Promise<JobHit[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const country = (process.env.ADZUNA_COUNTRY || "us").toLowerCase();

  const url = new URL(
    `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1`
  );
  url.searchParams.set("app_id", id);
  url.searchParams.set("app_key", key);
  url.searchParams.set("results_per_page", String(PER_FEED));
  url.searchParams.set("content-type", "application/json");
  if (what) url.searchParams.set("what", what);
  if (where) url.searchParams.set("where", where);

  const res = await withTimeout(url.toString());
  if (!res.ok) throw new Error(`Adzuna said ${res.status}`);
  const body = (await res.json()) as { results?: unknown[] };
  const rows = Array.isArray(body.results) ? body.results : [];

  return rows.flatMap((raw): JobHit[] => {
    const r = raw as Record<string, unknown>;
    const title = str(r.title);
    const link = str(r.redirect_url);
    if (!title || !link) return [];
    const company = r.company as Record<string, unknown> | undefined;
    const location = r.location as Record<string, unknown> | undefined;
    return [
      {
        source: "Adzuna",
        externalId: `adzuna:${str(r.id) ?? link}`,
        // Adzuna wraps titles in <strong> around the matched words.
        title: plain(title, 140) ?? title,
        company: str(company?.display_name),
        location: str(location?.display_name),
        salary: moneyRange(
          num(r.salary_min),
          num(r.salary_max),
          r.salary_is_predicted === "1" || r.salary_is_predicted === true
        ),
        snippet: plain(r.description),
        url: link,
        postedOn: str(r.created),
      },
    ];
  });
}

async function searchJooble(what: string, where: string): Promise<JobHit[]> {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];

  const res = await withTimeout(
    `https://jooble.org/api/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: what, location: where }),
    }
  );
  if (!res.ok) throw new Error(`Jooble said ${res.status}`);
  const body = (await res.json()) as { jobs?: unknown[] };
  const rows = Array.isArray(body.jobs) ? body.jobs : [];

  return rows.slice(0, PER_FEED).flatMap((raw): JobHit[] => {
    const r = raw as Record<string, unknown>;
    const title = str(r.title);
    const link = str(r.link);
    if (!title || !link) return [];
    return [
      {
        source: "Jooble",
        externalId: `jooble:${str(r.id) ?? link}`,
        title,
        company: str(r.company),
        location: str(r.location),
        // Jooble's salary is already free text ("$25 - $30 per hour").
        salary: str(r.salary),
        snippet: plain(r.snippet),
        url: link,
        postedOn: str(r.updated),
      },
    ];
  });
}

// The same job often sits on both feeds. Matching on company + title with the
// punctuation and casing knocked off catches most of it.
function dedupeKey(hit: JobHit): string {
  const flat = (s: string | null) =>
    (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${flat(hit.company)}|${flat(hit.title)}`;
}

export async function searchJobFeeds(
  what: string,
  where: string
): Promise<{ hits: JobHit[]; problems: string[] }> {
  const status = jobFeedsConfigured();
  const jobs: Promise<JobHit[]>[] = [];
  const names: string[] = [];
  if (status.adzuna) {
    jobs.push(searchAdzuna(what, where));
    names.push("Adzuna");
  }
  if (status.jooble) {
    jobs.push(searchJooble(what, where));
    names.push("Jooble");
  }

  // One feed being down shouldn't cost the results from the other, so each is
  // settled on its own and any failure is reported next to what did come back.
  const settled = await Promise.allSettled(jobs);
  const problems: string[] = [];
  const seen = new Set<string>();
  const hits: JobHit[] = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      problems.push(`${names[i]} didn't answer just now.`);
      return;
    }
    for (const hit of outcome.value) {
      const key = dedupeKey(hit);
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(hit);
    }
  });

  return { hits, problems };
}
