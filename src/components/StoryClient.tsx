"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import type { Story, StoryChapter } from "@/lib/story";

// ── The Debt Story ───────────────────────────────────────────────────────────
// The same chapters, in the same order, with the same figures as Money App's
// /divorce/story — because it's the same file, read over the API. This page
// only decides how it looks on a phone.
//
// Amounts arrive signed the way the evidence file records them: negative is
// money Chris paid out or is owed back. Every figure here is shown as a plain
// positive amount, because on Jamie's side the sign carries no information —
// it's all money he owes, and a page of minus signs reads as an accusation
// rather than a record.

// How many lines a chapter shows before "See all N lines".
const PREVIEW_LINES = 3;

// Money App tints each chapter by `tone`; these are the same five hues stepped
// for a light background rather than its dark one. Matching the palette rather
// than the exact hex is the point — the two pages should look like the same
// document, not like one is a screenshot of the other.
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
  const [allLines, setAllLines] = useState(false);
  const [background, setBackground] = useState(false);

  const lines = allLines ? chapter.entries : chapter.entries.slice(0, PREVIEW_LINES);
  const hidden = chapter.entries.length - lines.length;

  const accent = toneColor(chapter.tone);

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

      {chapter.total !== 0 && (
        <p className="mt-1 text-3xl font-medium" style={{ color: accent }}>
          {money(Math.abs(chapter.total))}
        </p>
      )}

      {/* Money App's own caption — the sentence that says what the figure above
          actually is. The narrative is background, behind a tap. */}
      {chapter.caption && (
        <p className="mt-1 text-[14px] text-muted">{chapter.caption}</p>
      )}

      {chapter.rollups.length > 0 && (
        <ul className="mt-3 space-y-1 text-[14px]">
          {chapter.rollups.map((r) => (
            <li key={r.label} className="flex justify-between gap-3">
              <span className="text-muted">{r.label}</span>
              <span className="shrink-0">{money(Math.abs(r.amount))}</span>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <ul className="mt-3 space-y-2 text-[14px]">
          {lines.map((e, i) => (
            <li key={`${e.label}-${i}`} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block">{e.label}</span>
                {(e.date || e.estimate) && (
                  <span className="block text-xs text-muted">
                    {e.date}
                    {e.date && e.estimate ? " · " : ""}
                    {e.estimate ? `worked out from ${e.estimate.basis}` : ""}
                  </span>
                )}
              </span>
              <span className="shrink-0">{money(Math.abs(e.amount))}</span>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-[14px]"
          onClick={() => setAllLines(true)}
        >
          See all {chapter.entries.length} lines
          <ChevronDown size={16} className="-rotate-90 text-muted" />
        </button>
      )}

      {chapter.narrative.length > 0 && (
        <>
          <button
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-[14px]"
            onClick={() => setBackground(!background)}
            aria-expanded={background}
          >
            Read the background
            <ChevronDown
              size={16}
              className={`text-muted transition-transform ${background ? "rotate-180" : "-rotate-90"}`}
            />
          </button>
          {background && (
            <div className="mt-2 space-y-2 text-[14px] text-muted">
              {chapter.narrative.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </>
      )}

      {background && chapter.evidence.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Source: {chapter.evidence.join("; ")}
        </p>
      )}
    </Card>
  );
}
