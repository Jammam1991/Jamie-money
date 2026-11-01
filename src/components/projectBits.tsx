import { daysUntil, type ProjectStatus } from "@/lib/projects";

// ── Bits both Projects screens share ─────────────────────────────────────────

// Where a project stands, in a colour he can read without the word.
export const STATUS_STYLE: Record<ProjectStatus, { bg: string; fg: string }> = {
  "Not started": { bg: "var(--tint)", fg: "var(--muted)" },
  "Working on it": { bg: "var(--reg-bg)", fg: "var(--reg)" },
  "Waiting on someone": { bg: "var(--warn-bg)", fg: "var(--warn)" },
  Done: { bg: "var(--good-bg)", fg: "var(--good)" },
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {status}
    </span>
  );
}

export const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function shortDate(iso: string, today: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// "in 3 days", "today", "2 days late" — and whether it needs flagging.
export function dueWord(iso: string, today: string): { text: string; late: boolean; soon: boolean } {
  const n = daysUntil(iso, today);
  if (n < 0) return { text: n === -1 ? "1 day late" : `${-n} days late`, late: true, soon: false };
  if (n === 0) return { text: "today", late: false, soon: true };
  if (n === 1) return { text: "tomorrow", late: false, soon: true };
  return { text: `in ${n} days`, late: false, soon: n <= 7 };
}

// "today", "yesterday", "5 days ago" — for when a project was last touched.
export function agoWord(isoStamp: string, today: string): string {
  const n = -daysUntil(isoStamp.slice(0, 10), today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 30) return `${n} days ago`;
  const months = Math.round(n / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}
