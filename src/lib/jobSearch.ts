// ── Finding jobs: the shapes both halves share ───────────────────────────────
// Import-free so the browser can use it too. The two halves are:
//   jobFeeds.ts  — searching the aggregators (Adzuna, Jooble)
//   jobLink.ts   — reading one job page Jamie pasted a link to
//
// Neither Indeed nor LinkedIn can be connected to directly: Indeed closed its
// public API in 2024 and blocks outside requests, and LinkedIn's jobs API has
// been partner-only since 2015 and isn't taking new partners. These two roads
// are what's actually reachable.

/** One job found by searching, from whichever feed turned it up. */
export interface JobHit {
  /** Which feed it came from, so the card can say. */
  source: string;
  /** The feed's own id — used to spot the same job twice. */
  externalId: string;
  title: string;
  company: string | null;
  location: string | null;
  /** Already turned into words, e.g. "$60,000 – $80,000 a year". */
  salary: string | null;
  snippet: string | null;
  url: string;
  postedOn: string | null;
}

/** What reading a pasted job link managed to work out. */
export interface LinkPreview {
  companyName: string | null;
  roleTitle: string | null;
  salary: string | null;
  location: string | null;
  /** The page's own name, e.g. "LinkedIn" — just for the "read from" line. */
  siteName: string | null;
  url: string;
}

// Salary numbers into something a person reads. Adzuna hands back plain
// numbers; Jooble hands back free text, which is passed straight through.
export function moneyRange(
  min: number | null,
  max: number | null,
  predicted = false
): string | null {
  const fmt = (n: number) =>
    "$" + Math.round(n).toLocaleString("en-US");
  let text: string;
  if (min && max && Math.round(min) !== Math.round(max)) {
    text = `${fmt(min)} – ${fmt(max)}`;
  } else if (min || max) {
    text = fmt((min || max) as number);
  } else {
    return null;
  }
  // Adzuna guesses a range when the employer didn't post one. Saying so keeps
  // a guess from being read as a promise.
  return predicted ? `about ${text} a year (estimated)` : `${text} a year`;
}
