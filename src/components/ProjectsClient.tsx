"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Bar, Card } from "./ui";
import { StatusPill, agoWord, dueWord, shortDate } from "./projectBits";
import {
  PROJECT_EMOJIS,
  blankProject,
  nextDate,
  stepProgress,
  type Project,
} from "@/lib/projects";
import { saveProject } from "@/lib/actions";

// ── The Projects list ────────────────────────────────────────────────────────
// One card per project: where it stands, the next thing to do, and the next
// date coming up. Tapping a card opens the project, where everything gets
// typed in. Finished ones fold away at the bottom so the list stays about
// what's still going.

export default function ProjectsClient({
  initial,
  today,
}: {
  initial: Project[];
  today: string;
}) {
  const active = initial.filter((p) => p.status !== "Done");
  const done = initial.filter((p) => p.status === "Done");
  const [showDone, setShowDone] = useState(false);
  const waiting = active.filter((p) => p.status === "Waiting on someone").length;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap gap-2 text-[13px]">
        <Chip>{active.length} on the go</Chip>
        {waiting > 0 && <Chip>{waiting} waiting on someone</Chip>}
        {done.length > 0 && <Chip>{done.length} done</Chip>}
      </div>

      <NewProject />

      {active.length === 0 && (
        <Card className="text-center text-[14px] text-muted">
          Nothing on the go. Tap &ldquo;New project&rdquo; to add one.
        </Card>
      )}

      <div className="space-y-3">
        {active.map((p) => (
          <ProjectCard key={p.id} project={p} today={today} />
        ))}
      </div>

      {done.length > 0 && (
        <section>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-[14px] font-medium text-muted"
          >
            {showDone ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Done ({done.length})
          </button>
          {showDone && (
            <div className="mt-3 space-y-3">
              {done.map((p) => (
                <ProjectCard key={p.id} project={p} today={today} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-tint px-3 py-1 text-muted">{children}</span>;
}

function ProjectCard({ project: p, today }: { project: Project; today: string }) {
  const { done, total } = stepProgress(p);
  const upcoming = nextDate(p);
  const due = upcoming ? dueWord(upcoming.date, today) : null;

  return (
    <Link href={`/projects/${p.id}`} className="block">
      <Card className="transition-colors hover:bg-tint/40">
        <div className="flex items-start gap-3">
          <div className="text-[28px] leading-none">{p.emoji}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[16px] font-medium leading-snug">{p.name}</div>
              <StatusPill status={p.status} />
            </div>

            <div className="mt-1 text-[14px] leading-snug">
              {p.nextStep ? (
                <>
                  <span className="text-muted">Next: </span>
                  {p.nextStep}
                </>
              ) : (
                <span className="text-faint">No next step written down yet</span>
              )}
            </div>

            {upcoming && due && (
              <div
                className="mt-1.5 flex items-center gap-1 text-[13px]"
                style={{ color: due.late ? "var(--neg)" : due.soon ? "var(--warn)" : "var(--muted)" }}
              >
                <CalendarDays size={14} />
                <span className="truncate">
                  {shortDate(upcoming.date, today)} ({due.text}) — {upcoming.what}
                </span>
              </div>
            )}

            {total > 0 && (
              <div className="mt-2.5">
                <Bar pct={(done / total) * 100} />
                <div className="mt-1 text-[12px] text-muted">
                  {done} of {total} steps done
                </div>
              </div>
            )}

            {p.updatedAt && (
              <div className="mt-1.5 text-[12px] text-faint">
                Updated {agoWord(p.updatedAt, today)}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ── Starting a new one ───────────────────────────────────────────────────────
// Just a name and a picture. Everything else is typed on the project's own
// screen, which is where this sends him straight after.
function NewProject() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PROJECT_EMOJIS[6]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-[15px] font-medium"
      >
        <Plus size={18} />
        New project
      </button>
    );
  }

  const create = () => {
    const clean = name.trim();
    if (!clean) {
      setError("Give it a name first.");
      return;
    }
    setError(null);
    const project = blankProject(clean, emoji);
    startTransition(async () => {
      const res = await saveProject(project);
      if (!res.ok) {
        setError(res.error ?? "That didn't save. Give it another go.");
        return;
      }
      router.push(`/projects/${project.id}`);
    });
  };

  return (
    <Card>
      <div className="text-[15px] font-medium">New project</div>
      <label className="mt-3 block">
        <span className="text-[14px]">What is it?</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="e.g. New apartment, Taxes, Passport"
          className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]"
        />
      </label>
      <div className="mt-3 text-[14px]">Pick a picture</div>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      {error && <div className="mt-2 text-[13px]" style={{ color: "var(--neg)" }}>{error}</div>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={create}
          disabled={pending}
          className="rounded-xl px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--good)" }}
        >
          {pending ? "Making it…" : "Make project"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setName("");
            setError(null);
          }}
          className="rounded-xl border border-border px-4 py-2.5 text-[15px]"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-8 gap-1.5">
      {PROJECT_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          aria-label={`Use ${e}`}
          className="flex aspect-square items-center justify-center rounded-xl border text-[22px]"
          style={{
            borderColor: value === e ? "var(--text)" : "var(--border)",
            background: value === e ? "var(--tint)" : "var(--card)",
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
