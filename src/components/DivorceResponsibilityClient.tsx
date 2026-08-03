"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import {
  STORY,
  chrisSpareMonthly,
  chrisSpareTotal,
  jamieEarlyTotal,
  jamieEarnedTotal,
  jamieHalfOfBusiness,
  jamieHalfOfDebt,
  jamieLateTotal,
  jamieOwes,
  jamieOwesNet,
  jamieRetirementClaim,
} from "@/lib/debtStory";

// The story is told in chapters, top to bottom, the way you'd tell it out loud:
// how the pile got built, who fed it, who paid for it, and what's left to settle.

export default function DivorceResponsibilityClient() {
  return (
    <div className="space-y-4">
      {/* The ending, up front — then the rest of the page explains it. */}
      <div className="rounded-2xl bg-warn-bg p-5 text-center">
        <p className="text-[15px] font-medium text-warn">
          🧾 What Jamie owes Chris
        </p>
        <p className="mt-1 text-5xl font-bold text-warn">{money(jamieOwes)}</p>
        <p className="mt-2 text-[13px] text-warn">
          Here&apos;s how that number got here.
        </p>
      </div>

      {/* ── 2020: the beginning ─────────────────────────────────────────── */}
      <Chapter
        n={1}
        emoji="💍"
        when={String(STORY.marriedYear)}
        title="We got married"
        accent="var(--fico)"
        bg="var(--fico-bg)"
      >
        <p className="text-[15px]">
          Two people, one set of bills. Everything after this point was built
          together — the good and the borrowed.
        </p>
      </Chapter>

      {/* ── The pile ────────────────────────────────────────────────────── */}
      <Chapter
        n={2}
        emoji="💳"
        when={`${STORY.marriedYear}–${STORY.separatedYear}`}
        title="The pile grew"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <p className="text-4xl font-bold" style={{ color: "var(--warn)" }}>
          {money(STORY.jointDebt)}
        </p>
        <p className="mt-1 text-[15px]">
          {`borrowed in ${STORY.yearsTogether} years. Not on emergencies — most of it went to keeping Jamie's lifestyle going.`}
        </p>
      </Chapter>

      {/* ── Where Chris's paycheck went ─────────────────────────────────── */}
      <Chapter
        n={3}
        emoji="💵"
        when="Every month"
        title="Chris's paycheck disappeared"
        accent="var(--reg)"
        bg="var(--reg-bg)"
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat
            label="Came in"
            value={money(STORY.chrisCashMonthly)}
            color="var(--good)"
          />
          <Stat
            label="His own bills"
            value={money(STORY.chrisBillsMonthly)}
            color="var(--text)"
          />
          <Stat
            label="Left over"
            value={money(chrisSpareMonthly)}
            color="var(--reg)"
          />
        </div>
        <p className="mt-3 text-[15px]">
          Chris didn&apos;t spend on himself, so that{" "}
          <strong>{money(chrisSpareMonthly)} a month</strong> should have piled
          up. Over {STORY.yearsTogether} years that&apos;s{" "}
          <strong>{money(chrisSpareTotal)}</strong>
          {" — and it went to Jamie's lifestyle instead."}
        </p>
      </Chapter>

      {/* ── What Jamie made vs what Jamie paid ──────────────────────────── */}
      <Chapter
        n={4}
        emoji="💰"
        when={`${STORY.marriedYear}–${STORY.separatedYear}`}
        title="Jamie was not broke"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <div className="space-y-2">
          <Row
            label={`${money(STORY.jamieWeeklyEarly)}/week × ${STORY.jamieEarlyYears} years`}
            value={money(jamieEarlyTotal)}
          />
          <Row
            label={`${money(STORY.jamieMonthlyLate)}/month × 1 year`}
            value={money(jamieLateTotal)}
          />
          <div className="flex items-center justify-between border-t border-border pt-2 text-[15px] font-semibold">
            <span>Jamie brought in</span>
            <span>{money(jamieEarnedTotal)}</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-card p-4 text-center">
          <p className="text-[13px] text-muted">
            Put toward the debt payments
          </p>
          <p className="text-5xl font-bold" style={{ color: "var(--warn)" }}>
            $0
          </p>
        </div>

        {/* Who actually made the payments. */}
        <div className="mt-4">
          <p className="mb-2 text-[13px] text-muted">Who paid the bill</p>
          <div className="flex h-6 overflow-hidden rounded-full bg-tint">
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: "100%", background: "var(--good)" }}
            >
              Chris 100%
            </div>
          </div>
          <p className="mt-2 text-[13px]">
            Chris&apos;s property covered the payments, and his paycheck covered
            the rest — including Jamie&apos;s half.
          </p>
        </div>
      </Chapter>

      {/* ── The one line in Jamie's favor ───────────────────────────────── */}
      <Chapter
        n={5}
        emoji="🏦"
        when={`Since ${STORY.marriedYear}`}
        title="The one thing that goes Jamie's way"
        accent="var(--good)"
        bg="var(--good-bg)"
      >
        <p className="text-[15px]">
          Chris built about <strong>{money(STORY.chris401k)}</strong> in
          401k/pension while they were married. That was built during the
          marriage, so roughly half of it —{" "}
          <strong>{money(jamieRetirementClaim)}</strong> — points back at Jamie.
        </p>
      </Chapter>

      {/* ── 2023: separated, still married on paper ─────────────────────── */}
      <Chapter
        n={6}
        emoji="🚪"
        when={String(STORY.separatedYear)}
        title="We separated"
        accent="var(--fico)"
        bg="var(--fico-bg)"
      >
        <p className="text-[15px]">
          Still legally married — on purpose, for the benefits. But the money
          story didn&apos;t change: Chris kept paying, Jamie kept spending.
        </p>
      </Chapter>

      {/* ── The gym ─────────────────────────────────────────────────────── */}
      <Chapter
        n={7}
        emoji="🏋️"
        when={`${STORY.separatedYear} onward`}
        title="Then we started the gym"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <div className="grid grid-cols-2 gap-2 text-center">
          <Stat
            label="Chris put in"
            value={money(STORY.businessInvestment)}
            color="var(--good)"
          />
          <Stat
            label="Jamie put in"
            value={money(STORY.jamieBusinessInvestment)}
            color="var(--warn)"
          />
        </div>

        <ul className="mt-4 space-y-2.5 text-[15px]">
          <Beat emoji="🤫">
            Jamie quietly stopped his massage business — the{" "}
            {money(STORY.jamieMonthlyLate)}/month one — and never told Chris.
          </Beat>
          <Beat emoji="🏧">
            Instead he pulled money out of the gym as distributions, no joint
            approval, calling it &ldquo;his paycheck.&rdquo;
          </Beat>
          <Beat emoji="🕳️">
            That left a hole every month. Chris refilled it, over and over.
          </Beat>
          <Beat emoji="💳">
            He refilled it with borrowed money — so the shortfall turned into
            more shared debt.
          </Beat>
        </ul>
      </Chapter>

      {/* ── The bill ────────────────────────────────────────────────────── */}
      <Card className="border-l-4" style={{ borderLeftColor: "var(--warn)" }}>
        <p className="mb-3 text-[15px] font-semibold">🧮 So here&apos;s the bill</p>
        <div className="space-y-2">
          <Row
            label={`Half the shared debt (${money(STORY.jointDebt)})`}
            value={money(jamieHalfOfDebt)}
          />
          <Row
            label={`Half the gym investment (${money(STORY.businessInvestment)})`}
            value={money(jamieHalfOfBusiness)}
          />
          <div className="flex items-center justify-between border-t border-border pt-2 text-lg font-bold">
            <span>Jamie owes</span>
            <span style={{ color: "var(--warn)" }}>{money(jamieOwes)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 text-[13px] text-muted">
            <span>Less half the retirement</span>
            <span>− {money(jamieRetirementClaim)}</span>
          </div>
          <div className="flex items-center justify-between text-[15px] font-semibold">
            <span>Net</span>
            <span>{money(jamieOwesNet)}</span>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Plus whatever the gym still needs to be made whole — that number keeps
          moving.
        </p>
      </Card>

      <Card className="bg-tint">
        <p className="text-xs text-muted">
          <strong>Chris&apos;s figures, not legal advice.</strong> These are
          estimates from memory and household records. What a court actually
          splits depends on state law, who benefited from each debt, how the
          business is structured, and what the two of you agree to. A lawyer has
          to sign off on the real number.
        </p>
      </Card>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

// One chapter of the story: a numbered, color-washed panel.
function Chapter({
  n,
  emoji,
  when,
  title,
  accent,
  bg,
  children,
}: {
  n: number;
  emoji: string;
  when: string;
  title: string;
  accent: string;
  bg: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border-l-4 p-4"
      style={{ background: bg, borderLeftColor: accent }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: accent }}
        >
          {n}
        </span>
        <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: accent }}>
          {when}
        </span>
      </div>
      <p className="mb-2 text-[19px] font-semibold">
        {emoji} {title}
      </p>
      {children}
    </div>
  );
}

// A labelled number in a little white tile.
function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// A label-on-the-left, amount-on-the-right line.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}

// One beat of the gym story.
function Beat({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 text-lg leading-tight">{emoji}</span>
      <span>{children}</span>
    </li>
  );
}
