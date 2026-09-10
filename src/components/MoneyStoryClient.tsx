"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { Card } from "@/components/ui";
import type {
  CashFlowStep,
  MoneyStory,
  MoneyStoryBasis,
  MoneyStoryChapter,
  MoneyStoryFact,
} from "@/lib/moneyStory";

// ── Our Money Story ─────────────────────────────────────────────────────────
// The personal chapter, told the same way Gym Story tells the business one:
// short chapters, one headline number each, tap to see the details behind
// it. See src/lib/moneyStory.ts for why the numbers here carry a confidence
// badge instead of a "from Money App" source line — most of them are Chris's
// own hand-reconstruction, not a live feed.

const TONE_COLOR: Record<MoneyStoryChapter["tone"], string> = {
  teal: "#0f766e",
  amber: "#b45309",
  rose: "#be123c",
  sky: "#0369a1",
  violet: "#6d28d9",
  gold: "#b9740c",
};

const BASIS_STYLE: Record<MoneyStoryBasis, { label: string; color: string }> = {
  measured: { label: "Measured", color: "var(--good)" },
  estimated: { label: "Estimate", color: "var(--warn)" },
  tbd: { label: "TBD", color: "var(--faint)" },
};

// Sign in front, not after — "-$3,200" reads as a loss immediately.
function money(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function Basis({ basis }: { basis: MoneyStoryBasis }) {
  const s = BASIS_STYLE[basis];
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ color: s.color, background: "var(--tint)" }}
    >
      {s.label}
    </span>
  );
}

export default function MoneyStoryClient({ story }: { story: MoneyStory }) {
  return (
    <div className="space-y-4">
      <Hero asOf={story.asOf} />

      <PartLabel>Part one — Personal</PartLabel>

      {story.chapters.map((chapter, i) => (
        <Chapter key={chapter.id} chapter={chapter} index={i} />
      ))}

      <CashFlowCard steps={story.cashFlow} />

      <PartLabel>Part two — Business</PartLabel>

      {/* Numbering runs straight on from the personal chapters — this is one
          story in two parts, not two lists that both start at 1. */}
      {story.businessChapters.map((chapter, i) => (
        <Chapter key={chapter.id} chapter={chapter} index={story.chapters.length + i} />
      ))}

      <GymStoryLink />

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

function Hero({ asOf }: { asOf: string }) {
  return (
    <div
      className="gym-fade-in rounded-2xl p-6 text-center"
      style={{ background: "linear-gradient(135deg, #14201f 0%, #1f3a3d 100%)" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/50">
        Chris &amp; Jamie
      </p>
      <p className="mt-1 text-3xl font-black tracking-tight text-white">Our Money Story</p>
      <p className="mx-auto mt-2 max-w-xs text-[13px] text-white/60">
        Not a legal document — just the numbers, so we can look at the same
        picture together.
      </p>
      <p className="mt-3 text-[11px] text-white/40">Updated {asOf}</p>
    </div>
  );
}

function PartLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-2 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-faint">
      {children}
    </p>
  );
}

function Chapter({ chapter, index }: { chapter: MoneyStoryChapter; index: number }) {
  const accent = TONE_COLOR[chapter.tone];

  return (
    <Card
      className="gym-fade-in border-l-4"
      style={{ borderLeftColor: accent, animationDelay: `${index * 60}ms` }}
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

      <p className="mt-2 text-[17px] font-medium">{chapter.title}</p>

      {chapter.paragraphs.length > 0 && (
        <div className="mt-2 space-y-2 text-[14px] text-muted">
          {chapter.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {chapter.fact && chapter.secondaryFact ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat fact={chapter.fact} accent={accent} />
          <MiniStat fact={chapter.secondaryFact} accent={accent} suffix="%" />
        </div>
      ) : (
        chapter.fact && <FactBlock fact={chapter.fact} accent={accent} />
      )}
    </Card>
  );
}

function MiniStat({ fact, accent, suffix }: { fact: MoneyStoryFact; accent: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-tint p-3 text-center">
      <p className="text-[11px] text-muted">{fact.label}</p>
      <p className="mt-0.5 text-xl font-semibold" style={{ color: accent }}>
        {fact.amount === null ? "TBD" : suffix ? `${fact.amount}${suffix}` : money(fact.amount)}
      </p>
      <div className="mt-1 flex justify-center">
        <Basis basis={fact.basis} />
      </div>
    </div>
  );
}

function FactBlock({ fact, accent }: { fact: MoneyStoryFact; accent: string }) {
  const [open, setOpen] = useState(false);
  const allBare = fact.breakdown?.every((l) => l.amount === 0) ?? false;

  return (
    <div className="mt-3 rounded-xl bg-tint p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] text-muted">{fact.label}</span>
        <Basis basis={fact.basis} />
      </div>
      <p className="mt-1 text-2xl font-semibold" style={{ color: fact.amount !== null && fact.amount < 0 ? "var(--neg)" : accent }}>
        {fact.amount === null ? "TBD" : money(fact.amount)}
      </p>
      <p className="mt-1 text-[12px] text-muted">{fact.note}</p>

      {fact.breakdown && fact.breakdown.length > 0 && (
        <>
          <button
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[13px]"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            style={{ borderColor: accent, color: accent }}
          >
            <span className="min-w-0 truncate">
              {open ? "Hide the details" : "See what's behind this"}
            </span>
            <ChevronDown
              size={15}
              className={`shrink-0 transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
            />
          </button>
          {open && (
            <div className="mt-2 px-1">
              <ul className="space-y-1.5">
                {fact.breakdown.map((l) => (
                  <li key={l.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0">{l.label}</span>
                    {!allBare && <span className="shrink-0 font-medium">{money(l.amount)}</span>}
                  </li>
                ))}
              </ul>
              {fact.breakdownNote && (
                <p className="mt-2 text-[11px] text-muted">{fact.breakdownNote}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CashFlowCard({ steps }: { steps: CashFlowStep[] }) {
  return (
    <Card className="gym-fade-in">
      <p className="text-[17px] font-medium">How the cash actually flows</p>
      <p className="mt-1 text-[13px] text-muted">A normal month, roughly. Tap a step for more.</p>
      <div className="mt-3 space-y-1.5">
        {steps.map((step, i) => (
          <CashFlowRow key={step.label} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
    </Card>
  );
}

function CashFlowRow({ step, isLast }: { step: CashFlowStep; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const bg = step.kind === "in" ? "var(--good-bg)" : step.kind === "result" ? "var(--warn-bg)" : "var(--tint)";
  const amtColor = step.kind === "in" ? "var(--good)" : step.kind === "result" ? "var(--neg)" : "var(--text)";

  return (
    <div>
      <button
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left"
        style={{ background: bg }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-medium">{step.label}</span>
          {step.sub && <span className="block text-[11px] text-muted">{step.sub}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Basis basis={step.basis} />
          <span className="text-[13px] font-semibold" style={{ color: amtColor }}>
            {step.amount === null
              ? step.kind === "result"
                ? "Negative"
                : "TBD"
              : `${step.kind === "out" ? "-" : ""}${money(step.amount)}${step.kind !== "result" ? "/mo" : ""}`}
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
          />
        </span>
      </button>
      {open && (
        <p className="px-3 pb-1 pt-1.5 text-[12px] text-muted">{step.explain}</p>
      )}
      {!isLast && (
        <div className="flex justify-center py-0.5 text-faint">
          <ChevronDown size={13} />
        </div>
      )}
    </div>
  );
}

function GymStoryLink() {
  return (
    <Link href="/gym-story">
      <Card className="gym-fade-in flex items-center gap-3 border-l-4" style={{ borderLeftColor: "#b9740c" }}>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: "#b9740c" }}
        >
          <Dumbbell size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-[0.15em] text-faint">
            The whole business story
          </span>
          <span className="block text-[15px] font-medium">Continue with the Gym Story →</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Card>
    </Link>
  );
}
