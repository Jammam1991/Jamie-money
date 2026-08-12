"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import StoryIntroSection from "@/components/StoryIntroSection";
import type { Story, StoryChapter, StoryLine } from "@/lib/story";

// ── The Debt Story ───────────────────────────────────────────────────────────
// Money App decides what each chapter says — which lines go on the face and in
// what order, what counts, what's excluded. This page draws that and decides
// nothing. Every time it decided something itself, it decided differently and
// the two pages disagreed.
//
// Amounts arrive signed the way the evidence file records them: negative is
// money Chris paid out or is owed back. Shown here as plain positive amounts,
// because on Jamie's side the sign carries no information — it's all money he
// owes — and a page of minus signs reads as an accusation rather than a record.

// Money App tints each chapter by `tone`; these are the same five hues stepped
// for a light background rather than its dark one.
const TONE_COLOR: Record<string, string> = {
  violet: "#6d28d9",
  sky: "#0369a1",
  amber: "#b45309",
  teal: "#0f766e",
  rose: "#be123c",
};

function toneColor(tone: string): string {
  return TONE_COLOR[tone] ?? TONE_COLOR.violet;
}

export default function StoryClient({ story }: { story: Story | null }) {
  if (!story) {
    return (
      <Card>
        <p className="text-[15px]">
          This page reads the record from Money App, and it can&apos;t reach it
          right now.
        </p>
        <p className="mt-2 text-[13px] text-muted">
          Nothing is missing — the figures live there, and this page shows them
          rather than keeping its own copy. Try again in a moment.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5 text-center text-white"
        style={{ background: "linear-gradient(135deg, #a56814 0%, #7d4a0b 100%)" }}
      >
        <p className="text-[13px] opacity-90">What Jamie owes Chris</p>
        <p className="text-4xl font-medium">{money(Math.abs(story.total))}</p>
        <p className="mt-1 text-[13px] opacity-90">
          Here&apos;s how that number got here.
        </p>
      </div>

      {/* The two things that run underneath every chapter, above them, as
          Money App has it. */}
      {story.intro.length > 0 && (
        <>
          <p className="px-1 text-[13px] font-medium">
            Two things run underneath every year below
          </p>
          {story.intro.map((s) => (
            <StoryIntroSection key={s.key} section={s} />
          ))}
        </>
      )}

      {story.chapters.map((c, i) => (
        <Chapter key={c.id} chapter={c} index={i + 1} />
      ))}

      {story.lastUpdated && (
        <p className="px-1 text-xs text-muted">Last updated {story.lastUpdated}</p>
      )}
    </div>
  );
}

function Chapter({ chapter, index }: { chapter: StoryChapter; index: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const accent = toneColor(chapter.tone);
  const toggle = (k: string) => setOpen(open === k ? null : k);

  return (
    <Card className="border-l-4" style={{ borderLeftColor: accent }}>
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ background: accent }}
        >
          {index}
        </span>
        <span className="text-[13px]" style={{ color: accent }}>
          {chapter.era}
        </span>
      </div>

      <p className="mt-2 text-[17px] font-medium">
        {chapter.emoji} {chapter.title}
      </p>

      {chapter.net !== 0 && (
        <p className="mt-1 text-3xl font-medium" style={{ color: accent }}>
          {money(Math.abs(chapter.net))}
        </p>
      )}

      {chapter.caption && (
        <p className="mt-1 text-[14px] text-muted">{chapter.caption}</p>
      )}

      {/* Money out, money back, and the net — only where some came back, which
          is Money App's call, not this page's. */}
      {chapter.showTiles && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Tile label="Chris paid out" value={money(Math.abs(chapter.paidOut))} />
          <Tile
            label="Came back"
            value={money(Math.abs(chapter.cameBack))}
            color="var(--good)"
          />
          <Tile label="Net" value={money(Math.abs(chapter.entryNet))} color={accent} />
        </div>
      )}

      {chapter.preview.length > 0 && (
        <ul className="mt-3 space-y-2 text-[14px]">
          {chapter.preview.map((e, i) => (
            // The face stays readable: label, date, amount. An estimate's
            // reasoning can run to a paragraph, and it belongs where someone
            // has chosen to look at it.
            <Line key={`${e.label}-${i}`} line={e} compact />
          ))}
        </ul>
      )}

      {chapter.entries.length > 0 && (
        <Drill
          label={`See all ${chapter.entries.length} ${chapter.entries.length === 1 ? "line" : "lines"}`}
          hint={`${chapter.actualCount} actual · ${chapter.estimateCount} estimate`}
          open={open === "lines"}
          onClick={() => toggle("lines")}
        >
          <ul className="space-y-2 text-[14px]">
            {chapter.entries.map((e, i) => (
              <Line key={`${e.label}-${i}`} line={e} />
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-border pt-2 text-[14px] font-medium">
            <span>Total for this chapter</span>
            <span>{money(Math.abs(chapter.entryNet))}</span>
          </p>
        </Drill>
      )}

      {chapter.rollups.length > 0 && (
        <Drill
          label={`See the ${chapter.rollups.length} rolled-up item${chapter.rollups.length === 1 ? "" : "s"}`}
          hint={money(Math.abs(chapter.rollupNet))}
          open={open === "rollups"}
          onClick={() => toggle("rollups")}
        >
          <ul className="space-y-2 text-[14px]">
            {chapter.rollups.map((r) => (
              <li key={r.label} className="flex justify-between gap-3">
                <span>{r.label}</span>
                <span className="shrink-0">{money(Math.abs(r.amount))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            These are summary figures rather than itemised transactions, so there
            are no statement lines behind them.
          </p>
        </Drill>
      )}

      {chapter.chrisOnly.length > 0 && (
        <Drill
          label={`Chris's own costs — not counted here (${chapter.chrisOnly.length})`}
          hint={money(Math.abs(chapter.chrisOnlyNet))}
          open={open === "chrisOnly"}
          onClick={() => toggle("chrisOnly")}
        >
          <p className="mb-2 text-xs text-muted">
            These are real costs Chris carried, but you aren&apos;t answerable for
            them — so they&apos;re left out of the figure above and out of
            anything owed back. They&apos;re kept on the record rather than
            deleted.
          </p>
          <ul className="space-y-2 text-[14px]">
            {chapter.chrisOnly.map((e, i) => (
              <Line key={`${e.label}-${i}`} line={e} />
            ))}
          </ul>
        </Drill>
      )}

      {chapter.narrative.length > 0 && (
        <Drill
          label="Read the background"
          open={open === "background"}
          onClick={() => toggle("background")}
        >
          <div className="space-y-2 text-[14px] text-muted">
            {chapter.narrative.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {chapter.evidence.length > 0 && (
              <p className="text-xs">Evidence: {chapter.evidence.join(" · ")}</p>
            )}
          </div>
        </Drill>
      )}
    </Card>
  );
}

function Line({ line, compact = false }: { line: StoryLine; compact?: boolean }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="min-w-0">
        <span className="block">{line.label}</span>
        {(line.date || line.estimate) && (
          <span className="block text-xs text-muted">
            {line.date}
            {line.date && line.estimate ? " · " : ""}
            {/* On the face, an estimate is marked and nothing more — the
                reasoning behind one runs to a paragraph and would bury the
                three lines it sits among. */}
            {line.estimate ? (compact ? "estimate" : `worked out from ${line.estimate.basis}`) : ""}
          </span>
        )}
      </span>
      <span className="shrink-0">{money(Math.abs(line.amount))}</span>
    </li>
  );
}

function Tile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-tint p-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-[15px] font-semibold" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function Drill({
  label,
  hint,
  open,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-[14px]"
        onClick={onClick}
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted">
          {hint && <span className="text-xs">{hint}</span>}
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
          />
        </span>
      </button>
      {open && <div className="mt-2 px-1">{children}</div>}
    </>
  );
}
