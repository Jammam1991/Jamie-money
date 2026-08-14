"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui";
import type { FinancialFact, GymChapter, GymStory, GymTone } from "@/lib/gymStory";

// ── The Gym Story ─────────────────────────────────────────────────────────
// Same shape as the old Debt Story: numbered chapters, a colored accent per
// chapter, expandable drill-downs. The numbers themselves come straight from
// Money App (see src/lib/gymStory.ts) — this component only decides how it
// looks.

const TONE_COLOR: Record<GymTone, string> = {
  gold: "#b9740c",
  amber: "#b45309",
  rose: "#be123c",
  sky: "#0369a1",
  violet: "#6d28d9",
  teal: "#0f766e",
};

// Sign in front, not after — "-$3,200" reads as a loss immediately, "$-3,200"
// doesn't.
function money(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

export default function GymStoryClient({ story }: { story: GymStory }) {
  return (
    <div className="space-y-4">
      <Hero story={story} />

      {story.chapters.map((chapter, i) => (
        <Chapter key={chapter.id} chapter={chapter} index={i} />
      ))}

      <Link
        href="/"
        className="flex items-center justify-center gap-1 py-2 text-[14px] text-muted"
      >
        <ChevronLeft size={16} />
        Back to My Cash
      </Link>
    </div>
  );
}

function Hero({ story }: { story: GymStory }) {
  return (
    <div
      className="gym-fade-in rounded-2xl p-6 text-center"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1c1c1c 100%)" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/50">
        Transformation Club
      </p>
      <p
        className="mt-1 text-4xl font-black tracking-tight"
        style={{
          background: "linear-gradient(135deg, #f2b632 0%, #c9960c 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        BOXING RX
      </p>
      <p className="mt-3 text-[16px] font-medium text-white">The Gym Story</p>
      <p className="mx-auto mt-1 max-w-xs text-[13px] text-white/60">
        How it started, told in the gym&apos;s own numbers — since {story.startLabel}.
      </p>
      <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-2.5">
          <p className="text-[11px] text-white/50">Money in, lifetime</p>
          <p className="mt-0.5 text-[15px] font-semibold text-white">
            {money(story.lifetime.income)}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 p-2.5">
          <p className="text-[11px] text-white/50">Money out, lifetime</p>
          <p className="mt-0.5 text-[15px] font-semibold text-white">
            {money(story.lifetime.expenses)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Chapter({ chapter, index }: { chapter: GymChapter; index: number }) {
  const accent = TONE_COLOR[chapter.tone];

  return (
    <Card
      className="gym-fade-in border-l-4"
      style={{ borderLeftColor: accent, animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ background: accent }}
        >
          {index + 1}
        </span>
        <span className="text-[13px] font-medium" style={{ color: accent }}>
          {chapter.era}
        </span>
      </div>

      <p className="mt-2 text-[17px] font-medium">
        {chapter.emoji} {chapter.title}
      </p>

      <div className="mt-2 space-y-2 text-[14px] text-muted">
        {chapter.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {chapter.fact && <FactBlock fact={chapter.fact} accent={accent} />}
    </Card>
  );
}

function FactBlock({ fact, accent }: { fact: FinancialFact; accent: string }) {
  const [open, setOpen] = useState<"breakdown" | "mistakes" | null>(null);
  const toggle = (k: "breakdown" | "mistakes") => setOpen(open === k ? null : k);

  if (fact.unavailable) {
    return (
      <p className="mt-3 rounded-xl bg-tint p-2.5 text-xs text-muted">
        Money App doesn&apos;t have data for {fact.sourceLabel} yet.
      </p>
    );
  }

  const positive = fact.amount >= 0;

  return (
    <div className="mt-3 rounded-xl bg-tint p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted">
          {fact.label} · {fact.sourceLabel}
        </span>
        <span
          className="shrink-0 text-xl font-semibold"
          style={{ color: positive ? "var(--good)" : "var(--neg)" }}
        >
          {money(fact.amount)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-card p-2">
          <p className="text-[11px] text-muted">In</p>
          <p className="text-[14px] font-medium">{money(fact.income)}</p>
        </div>
        <div className="rounded-lg bg-card p-2">
          <p className="text-[11px] text-muted">Out</p>
          <p className="text-[14px] font-medium">{money(fact.expenses)}</p>
        </div>
      </div>

      {fact.breakdown.length > 0 && (
        <Drill
          label={`See the ${fact.breakdown.length} categor${fact.breakdown.length === 1 ? "y" : "ies"} behind it`}
          open={open === "breakdown"}
          onClick={() => toggle("breakdown")}
        >
          <ul className="space-y-1.5">
            {fact.breakdown.map((l) => (
              <li key={l.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{l.label}</span>
                <span className="shrink-0 font-medium">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Straight from the gym&apos;s Schedule C categories in Money App — the
            same numbers Business Finances shows.
          </p>
        </Drill>
      )}

      {fact.mistakes.length > 0 && (
        <Drill
          label={`See the ${fact.mistakes.length} flagged transaction${fact.mistakes.length === 1 ? "" : "s"}`}
          open={open === "mistakes"}
          onClick={() => toggle("mistakes")}
          accent={accent}
        >
          <ul className="space-y-2">
            {fact.mistakes.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0">
                  <span className="block truncate">{m.name ?? "—"}</span>
                  <span className="block text-[11px] text-muted">
                    {m.date} · {m.category}
                    {m.memo && ` · ${m.memo}`}
                  </span>
                </span>
                <span className="shrink-0 font-medium" style={{ color: "var(--neg)" }}>
                  {money(m.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Individual transactions Chris flagged himself in Money App — not a
            category total.
          </p>
        </Drill>
      )}
    </div>
  );
}

function Drill({
  label,
  open,
  onClick,
  accent,
  children,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[13px]"
        onClick={onClick}
        aria-expanded={open}
        style={accent ? { borderColor: accent, color: accent } : undefined}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="mt-2 px-1">{children}</div>}
    </>
  );
}
