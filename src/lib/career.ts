// ── Career: the shapes and the plain maths ───────────────────────────────────
// Deliberately free of imports so the browser can use it too — the page's
// scoring and its "how long since" line run on the client. The readers that
// talk to the database live next door in careerStore.ts, and the writes are in
// actions.ts.

export type PathStatus = "Exploring" | "Shortlist" | "Ruled out";

export const PATH_STATUSES: PathStatus[] = [
  "Exploring",
  "Shortlist",
  "Ruled out",
];

export interface CareerPath {
  id: string;
  name: string;
  whatItIs: string | null;
  whatItTakes: string | null;
  payLow: number | null;
  payHigh: number | null;
  /** 1–5: how much he actually wants to do it. */
  wantIt: number;
  /** 1–5: whether the money works for his life. */
  paysEnough: number;
  /** 1–5: how easy it is to get started (5 = could start tomorrow). */
  easyToStart: number;
  status: PathStatus;
  notes: string | null;
}

// One number out of 100 from the three scores, weighted evenly. The whole
// point of the page: ask every path the same three questions, then let the list
// sort itself so the top two or three are obvious.
export function pathScore(p: {
  wantIt: number;
  paysEnough: number;
  easyToStart: number;
}): number {
  return Math.round(((p.wantIt + p.paysEnough + p.easyToStart) / 15) * 100);
}

// Best fit first. Ruled-out paths sink to the bottom whatever they scored —
// he's already said no to those.
export function sortPaths(paths: CareerPath[]): CareerPath[] {
  const out = (p: CareerPath) => (p.status === "Ruled out" ? 1 : 0);
  return [...paths].sort(
    (a, b) => out(a) - out(b) || pathScore(b) - pathScore(a)
  );
}

// ── Resumes ──────────────────────────────────────────────────────────────────

export interface Resume {
  id: string;
  label: string;
  aimedAt: string | null;
  fileName: string;
  uploadedAt: string;
  /** Signed download link, good for an hour. Null if Storage said no. */
  url: string | null;
}

// ── Applications ─────────────────────────────────────────────────────────────
// These are the same `job_postings` rows the Job vs Business page shows, plus
// three columns the Career page adds. One list, two screens — two lists of the
// same jobs would drift apart the first week.

export type ApplicationStatus =
  | "Interested"
  | "Applied"
  | "Interview"
  | "Offer"
  | "Rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Interested",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

export interface JobApplication {
  id: string;
  companyName: string;
  roleTitle: string;
  salary: string | null;
  link: string | null;
  status: ApplicationStatus;
  notes: string | null;
  appliedOn: string | null;
  resumeId: string | null;
  pathId: string | null;
  createdAt: string;
}

// ── People and places ────────────────────────────────────────────────────────

export type SourceKind =
  | "Person"
  | "Recruiter"
  | "Company"
  | "Website"
  | "Group";

export const SOURCE_KINDS: SourceKind[] = [
  "Person",
  "Recruiter",
  "Company",
  "Website",
  "Group",
];

export interface NetworkSource {
  id: string;
  name: string;
  kind: SourceKind;
  company: string | null;
  howToReach: string | null;
  link: string | null;
  lastContact: string | null;
  nextStep: string | null;
  notes: string | null;
}

// How long since he spoke to someone, in whole days. Null when there's no date
// on file — "never spoken to" and "spoke to them today" are different things,
// and the page says them differently.
export function daysSince(
  isoDate: string | null,
  today = new Date()
): number | null {
  if (!isoDate) return null;
  const then = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((start.getTime() - then.getTime()) / 86_400_000));
}
