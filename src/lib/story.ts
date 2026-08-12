// ── The settlement story, as Money App reads it ──────────────────────────────
// Not the raw evidence file — the worked-out view of it. Money App decides
// which lines go on the face and in what order, what counts toward a chapter's
// figure, which rows sit outside the arithmetic, and how much rests on
// documents rather than recollection.
//
// That matters because this page used to re-derive those rules and got them
// wrong every time: preview lines in the wrong order, a chapter understated by
// $2,500, Chris's own costs counted into a total they're meant to be outside
// of. Now there is one answer and this page only draws it.
//
// Uses the same MONEYAPP_API_URL / MONEYAPP_API_KEY as the debt sync.

export type StoryLine = {
  date: string | null;
  amount: number; // negative = money Chris paid out or is owed back
  label: string;
  source: string | null;
  estimate: { wasAmount: number | null; basis: string; needs: string } | null;
};

export type StoryChapter = {
  id: string;
  era: string;
  title: string;
  narrative: string[];
  evidence: string[];

  emoji: string;
  tone: string;
  caption: string;

  net: number; // the figure on the face
  entryNet: number; // entries only, for the total inside the drill-down
  paidOut: number;
  cameBack: number;
  showTiles: boolean;
  rollupNet: number;
  chrisOnlyNet: number;
  actualCount: number;
  estimateCount: number;

  preview: StoryLine[]; // already sorted and cut — render, don't decide
  entries: StoryLine[];
  chrisOnly: StoryLine[];
  rollups: { label: string; amount: number }[];
};

export type Story = {
  total: number;
  lastUpdated: string;
  chapters: StoryChapter[];
};

// Null when Money App isn't reachable or isn't configured. The page says so
// rather than falling back to figures of its own — a second set of numbers is
// exactly what this replaced.
export async function getStory(): Promise<Story | null> {
  const baseUrl = process.env.MONEYAPP_API_URL || process.env.MONEYAPP_URL;
  const apiKey = process.env.MONEYAPP_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/divorce/story`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!Array.isArray(body?.chapters)) return null;
    return {
      total: Number(body.total ?? 0),
      lastUpdated: String(body.lastUpdated ?? ""),
      chapters: body.chapters as StoryChapter[],
    };
  } catch {
    return null;
  }
}
