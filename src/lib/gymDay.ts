// ── Jamie's business day, from the gym dashboard ────────────────────────────
// Today's gym calendar (his classes, PT, NSIs, his own entries) and his open
// GoHighLevel tasks due by tonight, from the gym dashboard's /api/jamie/today.
// Shown on the home screen's Calendar and To do cards, behind a "Business"
// switch he can turn off. Same address and key as the pay figures (gymPay.ts).
// Server-side only: the key never leaves here.

import { headerSafe, originOf } from "./gymPay";

export type GymEvent = {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
};

export type GymTask = { id: string; title: string; dueAt: string | null; overdue: boolean };

export type GymDay = {
  events: GymEvent[];
  tasks: GymTask[];
  taskCount: number;
  overdueCount: number;
  /** Where "see them all" goes — the gym dashboard's task list. */
  tasksUrl: string;
};

/** Null when the gym dashboard isn't set up or didn't answer — the cards just leave business out. */
export async function getGymDay(): Promise<GymDay | null> {
  const origin = originOf(process.env.GYM_DASHBOARD_URL ?? "");
  const key = headerSafe(process.env.GYM_DASHBOARD_API_KEY);
  if (!origin || !key) return null;
  try {
    const res = await fetch(`${origin}/api/jamie/today`, {
      headers: { "x-api-key": key },
      // A few minutes old is fine for "what's on today", and it keeps every
      // home-screen visit from rebuilding the gym's calendar.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Partial<GymDay>;
    return {
      events: Array.isArray(d.events) ? d.events : [],
      tasks: Array.isArray(d.tasks) ? d.tasks : [],
      taskCount: Number(d.taskCount) || 0,
      overdueCount: Number(d.overdueCount) || 0,
      tasksUrl: `${origin}/tasks`,
    };
  } catch {
    return null;
  }
}
