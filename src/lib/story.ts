// ── The settlement story, straight from Money App ────────────────────────────
// The Debt Story page used to be written here, with its own chapters and its
// own figures. Money App keeps the real evidence file — every line compiled
// from statements and the Divorce workbook — and the two disagreed: $316,680
// here against $158,025 there, for the same claim.
//
// So this page no longer holds an opinion. It reads Money App's file and shows
// it. One document, two readers.
//
// Uses the same MONEYAPP_API_URL / MONEYAPP_API_KEY as the debt sync.

export type StoryEntry = {
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
  total: number;
  entries: StoryEntry[];
  rollups: { label: string; amount: number }[];
  evidence: string[];
  // How Money App draws the chapter. The caption in particular is the sentence
  // that says what the number on the card is — without it this page fell back
  // to the narrative's opening line and the two read differently.
  emoji: string;
  tone: string;
  caption: string;
};

export type Story = {
  total: number;
  lastUpdated: string;
  chapters: StoryChapter[];
};

// Null when Money App isn't reachable or isn't configured. The page says so
// rather than falling back to numbers of its own — a second set of figures is
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
