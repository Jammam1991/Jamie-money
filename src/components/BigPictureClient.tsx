"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui";
import {
  SCOPE_LABEL,
  type CreditLine,
  type FlowStep,
  type HouseholdPicture,
  type MoneyFlow,
  type MonthDraw,
  type Scope,
  type Slice,
} from "@/lib/householdPicture";

// ── The Big Picture ─────────────────────────────────────────────────────────
// Seven scenes, in the order the money actually moves. Each one is a picture
// first and a sentence second — a bar, a gauge, a row of arrows — because the
// point is for Jamie to *see* the loop, not read about it.
//
// Nothing is worked out in here. Every number arrives from
// src/lib/householdPicture.ts, which reads it from wherever it already lives.

// Objects rather than faces — a card that stands for a person shouldn't be
// picking what that person looks like.
const SCOPE_EMOJI: Record<Scope, string> = {
  chris: "💳",
  jamie: "💵",
  joint: "🤝",
  business: "🏋️",
  lennon: "🏘️",
};

const RED = "#b3261e";
const GREEN = "#167a5b";
const AMBER = "#b45309";
const VIOLET = "#6d28d9";
const SKY = "#0369a1";

// Sign in front, not after — "-$3,200" reads as a loss immediately.
function money(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

// ── Accounts filed under one owner that someone else actually owes ───────────
// The Beacon HELOC is booked to the rental because the property is what
// secures it, but the balance is Chris and Jamie's own borrowing. Without
// saying so the rental's total reads as if the property ran it up.
//
// Matched on the name rather than the account id: an id changes if the account
// is re-linked in Money App, the name doesn't. If Chris ever fills in the
// account's Notes field over there, that becomes the better source and this
// list can go.
const ACCOUNT_NOTES: { match: RegExp; note: string }[] = [
  { match: /beacon/i, note: "Chris/Jamie Debt" },
];

function accountNote(name: string): string | null {
  return ACCOUNT_NOTES.find((n) => n.match.test(name))?.note ?? null;
}

export default function BigPictureClient({
  picture,
  admin,
}: {
  picture: HouseholdPicture;
  admin: boolean;
}) {
  return (
    <div className="space-y-4">
      <Hero picture={picture} />
      {/* Scene numbers are positions in the story, so they're counted here
          rather than hardcoded — the flow scene sits out when the incomes
          aren't set, and everything below it has to close up behind it. */}
      {(() => {
        const scenes: ((i: number) => React.ReactNode)[] = [
          (i) => <Scene1Owed key="owed" picture={picture} index={i} />,
          ...(picture.flow
            ? [(i: number) => <SceneSpending key="spending" flow={picture.flow!} index={i} />]
            : []),
          (i) => <SceneMonth key="month" picture={picture} index={i} admin={admin} />,
          (i) => <SceneGap key="gap" picture={picture} index={i} />,
          (i) => <SceneGym key="gym" picture={picture} index={i} />,
          (i) => <SceneCredit key="credit" picture={picture} index={i} />,
          (i) => <SceneRunway key="runway" picture={picture} index={i} />,
          (i) => <SceneFix key="fix" picture={picture} index={i} />,
        ];
        return scenes.map((render, i) => render(i));
      })()}

      <p className="px-2 text-center text-[11px] text-muted">
        Read live from the Money App, the gym dashboard and this app&apos;s own
        Bills page. The only figures typed in by hand are Chris&apos;s pay and the
        rent from the rental — nothing else in the app knows those.
      </p>

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

// ── The top of the story ─────────────────────────────────────────────────────

function Hero({ picture }: { picture: HouseholdPicture }) {
  // One card open at a time — tapping a second card swaps to it rather than
  // stacking two account lists under a hero that's meant to be a summary.
  const [expanded, setExpanded] = useState<Scope | null>(null);

  return (
    <div
      className="gym-fade-in rounded-2xl p-6 text-center"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #221c1c 100%)" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/50">
        The Big Picture
      </p>
      <p className="mt-3 text-[13px] text-white/60">Everything we owe right now</p>
      <p
        className="mt-1 text-[42px] leading-none font-black tracking-tight"
        style={{
          background: "linear-gradient(135deg, #ff8a80 0%, #d64545 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {money(picture.totalDebt)}
      </p>
      {/* One card per owner rather than a personal/business split — the first
          question is whose it is, and the two-bucket cut is scene 1's job.
          Each one taps open to the accounts behind it. */}
      <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2">
        {picture.byScope.map((s, i) => {
          const isOpen = expanded === s.scope;
          return (
            <button
              key={s.scope}
              type="button"
              onClick={() => setExpanded(isOpen ? null : s.scope)}
              aria-expanded={isOpen}
              // An odd count would otherwise leave the last card stranded in
              // half a row. Joint only appears when it has a balance, so the
              // count genuinely varies.
              className={`rounded-xl bg-white/5 p-2.5 text-left transition-colors hover:bg-white/10 ${
                picture.byScope.length % 2 === 1 && i === picture.byScope.length - 1
                  ? "col-span-2"
                  : ""
              }`}
              style={isOpen ? { background: "rgba(255,255,255,0.12)" } : undefined}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-[18px]">{SCOPE_EMOJI[s.scope]}</p>
                <ChevronDown
                  size={13}
                  className="mt-1 shrink-0 text-white/40 transition-transform"
                  style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-white/50">{s.name}</p>
              <p className="text-[15px] font-semibold text-white">{money(s.amount)}</p>
            </button>
          );
        })}
      </div>

      {expanded && (
        <div className="mx-auto mt-3 max-w-sm rounded-xl bg-white/5 p-3 text-left">
          <p className="text-[12px] font-medium text-white/70">
            {SCOPE_LABEL[expanded]} accounts
          </p>
          <ul className="mt-2 space-y-1.5">
            {picture.accounts
              .filter((a) => a.scope === expanded)
              .map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="min-w-0 truncate text-white/70">
                    {a.name}
                    {accountNote(a.name) && (
                      <span className="text-white/40"> ({accountNote(a.name)})</span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-white">{money(a.balance)}</span>
                </li>
              ))}
          </ul>
          {expanded === "jamie" && (
            <p className="mt-2.5 border-t border-white/10 pt-2.5 text-[11px] text-white/50">
              Only what&apos;s in Jamie&apos;s name at the banks. What Chris has lent her
              personally isn&apos;t counted here — that&apos;s scene 3, below.
            </p>
          )}
        </div>
      )}

      <p className="mx-auto mt-4 max-w-xs text-[12px] text-white/50">
        Scroll down to see how it got there — and where it&apos;s going.
      </p>
    </div>
  );
}

// ── Scene 1: the pile ────────────────────────────────────────────────────────

function Scene1Owed({ picture, index }: { picture: HouseholdPicture; index: number }) {
  const total = picture.totalDebt || 1;
  // The rental keeps its own band. Its mortgage sits against something that
  // earns rent, so folding it into "personal" overstated what the two of them
  // actually owe.
  const bands = [
    { key: "gym", color: AMBER, label: "🏋️ The gym's debt", amount: picture.businessDebt },
    { key: "personal", color: VIOLET, label: "🏠 Our personal debt", amount: picture.personalDebt },
    { key: "rental", color: SKY, label: "🏘️ Chris's rental property", amount: picture.rentalDebt },
  ].filter((b) => b.amount > 0);

  return (
    <Scene index={index} emoji="🏔️" title="What we owe" accent={RED}>
      <div className="mt-3 flex h-6 w-full overflow-hidden rounded-full bg-tint">
        {bands.map((b) => (
          <div
            key={b.key}
            style={{ width: `${(b.amount / total) * 100}%`, background: b.color }}
          />
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {bands.map((b) => (
          <KeyRow key={b.key} color={b.color} label={b.label} amount={b.amount} />
        ))}
      </div>

      <Drill label={`See all ${picture.accounts.length} accounts`}>
        <div className="space-y-3">
          {picture.byScope.map((s) => (
            <div key={s.scope}>
              <div className="flex items-baseline justify-between gap-3 text-[13px] font-medium">
                <span>{s.label}</span>
                <span>{money(s.amount)}</span>
              </div>
              <ul className="mt-1 space-y-1">
                {picture.accounts
                  .filter((a) => a.scope === s.scope)
                  .map((a) => (
                    <li
                      key={a.id}
                      className="flex items-baseline justify-between gap-3 text-[12px] text-muted"
                    >
                      <span className="min-w-0 truncate">
                        {a.name}
                        {accountNote(a.name) && (
                          <span className="text-faint"> ({accountNote(a.name)})</span>
                        )}
                      </span>
                      <span className="shrink-0">{money(a.balance)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Drill>
    </Scene>
  );
}

// ── Scene 2: Jamie's month, in and out ───────────────────────────────────────

// ── Scene: everything in, everything out, in the order it leaves ─────────────

function SceneSpending({ flow, index }: { flow: MoneyFlow; index: number }) {
  const short = flow.shortfall < 0;

  return (
    <Scene index={index} emoji="🌊" title="Total spending" accent={short ? RED : GREEN}>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: "var(--good-bg)" }}>
          <p className="text-[11px]" style={{ color: GREEN }}>
            Everything in
          </p>
          <p className="text-[20px] font-black leading-tight" style={{ color: GREEN }}>
            {money(flow.incomeMonthly)}
          </p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "#fdeceb" }}>
          <p className="text-[11px]" style={{ color: RED }}>
            Everything out
          </p>
          <p className="text-[20px] font-black leading-tight" style={{ color: RED }}>
            {money(flow.outMonthly)}
          </p>
        </div>
      </div>

      <Drill label="See where the money comes from">
        <SliceList title="" slices={flow.incomeParts} color={GREEN} />
      </Drill>

      <p className="mt-5 text-center text-[13px] text-muted">
        Now watch it leave, in the order it actually goes:
      </p>

      {/* The waterfall. Each rung takes its bite and the bar below shows what's
          still standing — which is the whole point: it's still green until the
          banks are paid, and then it isn't. */}
      <div className="mt-3">
        <FlowTop amount={flow.incomeMonthly} />
        {flow.steps.map((s) => (
          <FlowRung key={s.key} step={s} income={flow.incomeMonthly} />
        ))}
      </div>

      <div
        className="mt-4 rounded-xl p-3 text-center"
        style={{ background: short ? "#fdeceb" : "var(--good-bg)" }}
      >
        <p className="text-[12px]" style={{ color: short ? RED : GREEN }}>
          {short ? "Short every month by" : "Left over every month"}
        </p>
        <p
          className="text-[30px] font-black leading-tight"
          style={{ color: short ? RED : GREEN }}
        >
          {money(Math.abs(flow.shortfall))}
        </p>
        {short && (
          <>
            <p className="mt-1 text-[20px]">↓</p>
            <p className="text-[13px] font-medium" style={{ color: RED }}>
              💳 It goes onto the lines of credit
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Every month. That&apos;s why they keep maxing out — see below.
            </p>
          </>
        )}
      </div>

      {(flow.incomeIncomplete || flow.budgetMissing) && (
        <p className="mt-3 rounded-lg bg-warn-bg p-2 text-[11px] text-warn">
          {flow.incomeIncomplete &&
            "Some income hasn't been filled in yet, so the top number is low. "}
          {flow.budgetMissing &&
            "Money App isn't sending a household budget, so living expenses read as zero here."}
        </p>
      )}
    </Scene>
  );
}

/** The full bar the waterfall starts from — a month's income, untouched. */
function FlowTop({ amount }: { amount: number }) {
  return (
    <div className="rounded-xl bg-tint p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium">💰 Money in</span>
        <span className="text-[15px] font-bold" style={{ color: GREEN }}>
          {money(amount)}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full" style={{ width: "100%", background: GREEN }} />
      </div>
    </div>
  );
}

function FlowRung({ step, income }: { step: FlowStep; income: number }) {
  const gone = step.remaining < 0;
  // The bar measures what's LEFT, so an overdrawn month shows an empty bar and
  // the red number does the talking. A negative width would just vanish.
  const pct = income > 0 ? Math.max(0, (step.remaining / income) * 100) : 0;

  return (
    <>
      <p className="py-1 text-center text-[16px] text-muted">↓</p>
      <div className="rounded-xl bg-tint p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-[13px] font-medium">
            {step.emoji} {step.label}
          </span>
          <span className="shrink-0 text-[15px] font-bold" style={{ color: RED }}>
            −{money(step.amount)}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: gone ? RED : GREEN }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {gone ? "Nothing left — " : "Still left: "}
          <span className="font-medium" style={{ color: gone ? RED : "inherit" }}>
            {gone ? `over by ${money(-step.remaining)}` : money(step.remaining)}
          </span>
        </p>
        {step.note && <p className="mt-1 text-[11px] text-faint">{step.note}</p>}
      </div>
    </>
  );
}

function SceneMonth({
  picture,
  index,
  admin,
}: {
  picture: HouseholdPicture;
  index: number;
  admin: boolean;
}) {
  const short = picture.gapMonthly > 0;
  const biggest = Math.max(picture.incomeMonthly, picture.billsMonthly, 1);

  return (
    <Scene index={index} emoji="💵" title="Jamie's month" accent={SKY}>
      <div className="mt-4 flex items-end justify-center gap-8">
        <BigBar
          label="Comes in"
          amount={picture.incomeMonthly}
          pct={(picture.incomeMonthly / biggest) * 100}
          color={GREEN}
        />
        <BigBar
          label="Goes out"
          amount={picture.billsMonthly}
          pct={(picture.billsMonthly / biggest) * 100}
          color={RED}
        />
      </div>

      <div
        className="mt-4 rounded-xl p-3 text-center"
        style={{ background: short ? "#fdeceb" : "var(--good-bg)" }}
      >
        <p className="text-[12px]" style={{ color: short ? RED : GREEN }}>
          {short ? "Short every month by" : "Spare every month"}
        </p>
        <p
          className="text-[26px] font-black leading-tight"
          style={{ color: short ? RED : GREEN }}
        >
          {money(Math.abs(picture.gapMonthly))}
        </p>
      </div>

      <Drill label="See what comes in and what goes out">
        <SliceList title="Comes in" slices={picture.incomeParts} color={GREEN} />
        <div className="mt-3">
          <SliceList title="Goes out" slices={picture.billParts} color={RED} />
        </div>
      </Drill>

      {admin && picture.payProblem && (
        <p className="mt-3 rounded-lg bg-warn-bg p-2 text-[11px] text-warn">
          Admin only — the gym pay figure is missing: {picture.payProblem}
        </p>
      )}
    </Scene>
  );
}

// ── Scene 3: who fills the gap ───────────────────────────────────────────────

function SceneGap({ picture, index }: { picture: HouseholdPicture; index: number }) {
  const anyDraws = picture.draws.some((d) => d.amount > 0);

  return (
    <Scene index={index} emoji="🕳️" title="Who fills the gap" accent={AMBER}>
      <Flow
        steps={[
          { emoji: "💳", label: "Chris's credit" },
          { emoji: "💵", label: "Borrowed" },
          { emoji: "🧾", label: "Jamie's bills" },
        ]}
      />
      <p className="mt-3 text-center text-[13px] text-muted">
        There&apos;s no spare money to cover it. Chris borrows it.
      </p>

      {anyDraws ? (
        <>
          <MonthBars draws={picture.draws} color={AMBER} />
          <p className="mt-2 text-center text-[12px] text-muted">
            About{" "}
            <span className="font-semibold" style={{ color: AMBER }}>
              {money(picture.drawAverage)}
            </span>{" "}
            in the months it happens.
          </p>

          {picture.drawSources.length > 0 && (
            <Drill label="See which account it came out of">
              <SliceList title="" slices={picture.drawSources} color={AMBER} />
              <p className="mt-2 text-[11px] text-muted">
                Straight from the Money App ledger — these are real transfers,
                not a number worked out from the gap above.
              </p>
            </Drill>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-tint p-2.5 text-center text-[12px] text-muted">
          The Money App has no money lent to Jamie recorded in the last 6 months.
        </p>
      )}
    </Scene>
  );
}

// ── Scene 4: why the gym can't pay him ───────────────────────────────────────

function SceneGym({ picture, index }: { picture: HouseholdPicture; index: number }) {
  const profit = picture.gymProfitMonthly;
  const losing = profit != null && profit < 0;

  return (
    <Scene index={index} emoji="🏋️" title="The gym can't pay him" accent={RED}>
      {profit == null ? (
        <p className="mt-3 rounded-xl bg-tint p-2.5 text-[12px] text-muted">
          The Money App doesn&apos;t have the gym&apos;s profit for these months
          yet.
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-xl bg-tint p-3 text-center">
            <p className="text-[12px] text-muted">
              What the gym makes in an average month
            </p>
            <p
              className="text-[30px] font-black leading-tight"
              style={{ color: losing ? RED : GREEN }}
            >
              {money(profit)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{picture.gymMonthsLabel}</p>
          </div>

          {losing && (
            <>
              <Flow
                steps={[
                  { emoji: "💳", label: "Chris's credit" },
                  { emoji: "🏋️", label: "The gym" },
                  { emoji: "🧑", label: "Jamie's pay" },
                ]}
              />
              <p className="mt-3 text-center text-[13px] text-muted">
                The gym loses money, so the{" "}
                <span className="font-semibold" style={{ color: RED }}>
                  {money(picture.gymPayMonthly)}
                </span>{" "}
                a month it pays Jamie is borrowed too. His paycheck goes straight
                onto the pile.
              </p>
            </>
          )}
        </>
      )}
    </Scene>
  );
}

// ── Scene 5: the fuel left in the tank ───────────────────────────────────────

const CREDIT_TITLE = "How much cash we have available to borrow";

function SceneCredit({ picture, index }: { picture: HouseholdPicture; index: number }) {
  if (!picture.hasLimits) {
    return (
      <Scene index={index} emoji="⛽" title={CREDIT_TITLE} accent={GREEN}>
        <p className="mt-3 rounded-xl bg-tint p-2.5 text-[12px] text-muted">
          None of the lines of credit are reporting a limit right now, so
          there&apos;s nothing to measure the cash left against.
        </p>
      </Scene>
    );
  }

  const leftPct = Math.round((picture.creditLeftTotal / (picture.creditLimitTotal || 1)) * 100);
  const tone = leftPct <= 15 ? RED : leftPct <= 35 ? AMBER : GREEN;

  return (
    <Scene index={index} emoji="⛽" title={CREDIT_TITLE} accent={tone}>
      <div className="mt-3 text-center">
        <p className="text-[12px] text-muted">Cash left to borrow</p>
        <p className="text-[34px] font-black leading-tight" style={{ color: tone }}>
          {money(picture.creditLeftTotal)}
        </p>
        <p className="text-[12px] text-muted">
          of {money(picture.creditLimitTotal)} — {leftPct}% left
        </p>
      </div>

      <Gauge leftPct={leftPct} color={tone} />

      <div className="mt-4 space-y-3">
        {picture.lines.map((l) => (
          <LineRow key={l.id} line={l} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Lines of credit only. Room on a credit card isn&apos;t cash — it
        can&apos;t cover a mortgage payment or the gym&apos;s payroll, which is
        what the shortfall above is made of.
      </p>
    </Scene>
  );
}

// Under this much left and the line is done, whatever the percentage says.
// "$49 left" on an $11,000 card invites one more swipe; MAXED OUT doesn't.
const MAXED_OUT_UNDER = 500;

function LineRow({ line }: { line: CreditLine }) {
  const maxed = line.available < MAXED_OUT_UNDER;
  const tone = maxed || line.leftPct <= 15 ? RED : line.leftPct <= 35 ? AMBER : GREEN;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px]">{line.name}</span>
        {maxed ? (
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white"
            style={{ background: RED }}
          >
            MAXED OUT
          </span>
        ) : (
          <span className="shrink-0 text-[13px] font-semibold" style={{ color: tone }}>
            {money(line.available)} left
          </span>
        )}
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-tint">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(2, line.leftPct)}%`, background: tone }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        {SCOPE_LABEL[line.scope]} · {money(line.used)} used of {money(line.limit)}
      </p>
    </div>
  );
}

// ── Scene 6: how fast it's running out ───────────────────────────────────────

function SceneRunway({ picture, index }: { picture: HouseholdPicture; index: number }) {
  const months = picture.monthsLeft;
  const tone = months == null ? GREEN : months <= 6 ? RED : months <= 18 ? AMBER : GREEN;

  return (
    <Scene index={index} emoji="⏳" title="How fast it's running out" accent={tone}>
      {picture.burnMonthly > 0 ? (
        <>
          <div className="mt-3 rounded-xl bg-tint p-3 text-center">
            <p className="text-[12px] text-muted">Added to the pile every month</p>
            <p className="text-[28px] font-black leading-tight" style={{ color: RED }}>
              +{money(picture.burnMonthly)}
            </p>
          </div>

          <div className="mt-2 space-y-1.5">
            {picture.burnParts.map((p) => (
              <div
                key={p.label}
                className="flex items-baseline justify-between gap-3 text-[12px]"
              >
                <span className="min-w-0 truncate text-muted">{p.label}</span>
                <span className="shrink-0 font-medium">{money(p.amount)}</span>
              </div>
            ))}
          </div>

          {months == null ? (
            // Two very different things both land here, and saying the wrong
            // one is alarming: no limits on record means we can't measure the
            // runway, not that the runway has run out.
            <p className="mt-4 rounded-xl bg-tint p-2.5 text-center text-[12px] text-muted">
              {picture.hasLimits
                ? "There's no room left on any of the credit lines to measure this against."
                : "The banks aren't reporting credit limits right now, so there's nothing to measure this against."}
            </p>
          ) : (
            <>
              <p className="mt-5 text-center text-[13px] text-muted">
                At that rate, the credit lasts about
              </p>
              <p
                className="text-center text-[34px] font-black leading-tight"
                style={{ color: tone }}
              >
                {months >= 24 ? "2+ years" : `${Math.max(1, Math.round(months))} months`}
              </p>
              <MonthDots months={months} color={tone} />
              <p className="mt-3 text-center text-[12px] text-muted">
                Then there&apos;s nothing left to borrow.
              </p>
            </>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-xl p-2.5 text-center text-[13px]" style={{ background: "var(--good-bg)", color: GREEN }}>
          Nothing new is being borrowed at the moment. 🎉
        </p>
      )}
    </Scene>
  );
}

// ── Scene 7: what closes it ──────────────────────────────────────────────────

function SceneFix({ picture, index }: { picture: HouseholdPicture; index: number }) {
  if (picture.burnMonthly <= 0) return null;

  return (
    <Scene index={index} emoji="✅" title="What would stop it" accent={GREEN}>
      <p className="mt-2 text-[13px] text-muted">
        Two numbers have to move. Together they&apos;re the{" "}
        {money(picture.burnMonthly)} a month.
      </p>

      <div className="mt-3 space-y-2">
        {picture.burnParts.map((p) => (
          <div
            key={p.label}
            className="flex items-center justify-between gap-3 rounded-xl bg-tint p-3"
          >
            <span className="min-w-0 text-[13px]">{p.fixLabel}</span>
            <span className="shrink-0 text-[17px] font-bold" style={{ color: GREEN }}>
              +{money(p.amount)}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Close both and nothing new goes on the pile. Anything past that starts
        paying it down.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/business-finances"
          className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium"
          style={{ color: SKY }}
        >
          The gym&apos;s books →
        </Link>
        <Link
          href="/bills"
          className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium"
          style={{ color: SKY }}
        >
          Jamie&apos;s bills →
        </Link>
      </div>
    </Scene>
  );
}

// ── The pieces every scene is built from ─────────────────────────────────────

function Scene({
  index,
  emoji,
  title,
  accent,
  children,
}: {
  index: number;
  emoji: string;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
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
        <p className="text-[17px] font-medium">
          {emoji} {title}
        </p>
      </div>
      {children}
    </Card>
  );
}

/** One of the two columns in the in-vs-out picture. */
function BigBar({
  label,
  amount,
  pct,
  color,
}: {
  label: string;
  amount: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 text-[15px] font-bold" style={{ color }}>
        {money(amount)}
      </span>
      <div className="flex h-32 w-16 items-end">
        <div
          className="w-full rounded-t-lg transition-all duration-700"
          style={{ height: `${Math.max(6, pct)}%`, background: color }}
        />
      </div>
      <span className="mt-1.5 text-[12px] text-muted">{label}</span>
    </div>
  );
}

/** Small tiles with arrows between them — the money's route, in three steps. */
function Flow({ steps }: { steps: { emoji: string; label: string }[] }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          <div className="flex w-[74px] flex-col items-center rounded-xl bg-tint px-1 py-2.5">
            <span className="text-[20px]">{s.emoji}</span>
            <span className="mt-0.5 text-center text-[10px] leading-tight text-muted">
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-[15px] text-muted">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Six little columns: what Chris actually handed over, month by month. */
function MonthBars({ draws, color }: { draws: MonthDraw[]; color: string }) {
  const biggest = Math.max(...draws.map((d) => d.amount), 1);
  return (
    <div className="mt-4 flex items-end justify-between gap-1.5">
      {draws.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center">
          <span className="mb-1 text-[10px] font-medium" style={{ color }}>
            {d.amount > 0 ? money(d.amount) : ""}
          </span>
          <div className="flex h-20 w-full items-end">
            <div
              className="w-full rounded-t transition-all duration-700"
              style={{
                height: `${Math.max(3, (d.amount / biggest) * 100)}%`,
                background: d.amount > 0 ? color : "var(--border)",
              }}
            />
          </div>
          <span className="mt-1 text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** The whole tank at a glance — how much of the credit is still there. */
function Gauge({ leftPct, color }: { leftPct: number; color: string }) {
  return (
    <div className="mt-4">
      <div className="relative h-8 w-full overflow-hidden rounded-full bg-tint">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(2, leftPct)}%`, background: color }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>Empty</span>
        <span>Full</span>
      </div>
    </div>
  );
}

/**
 * Two years of squares, filled for as long as the credit holds out — a fixed
 * 12-wide grid rather than a wrapping row, so the second year always lines up
 * under the first instead of trailing off centred.
 */
function MonthDots({ months, color }: { months: number; color: string }) {
  const filled = Math.min(24, Math.max(1, Math.round(months)));
  return (
    <div className="mx-auto mt-3 grid max-w-[260px] grid-cols-12 gap-1">
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className="aspect-square rounded-sm"
          style={{ background: i < filled ? color : "var(--border)" }}
        />
      ))}
    </div>
  );
}

function KeyRow({
  color,
  label,
  amount,
}: {
  color: string;
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-[14px]">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[15px] font-semibold">{money(amount)}</span>
    </div>
  );
}

function SliceList({
  title,
  slices,
  color,
}: {
  title: string;
  slices: Slice[];
  color: string;
}) {
  return (
    <div>
      {title && (
        <p className="mb-1 text-[12px] font-medium" style={{ color }}>
          {title}
        </p>
      )}
      <ul className="space-y-1">
        {slices.map((s) => (
          <li
            key={s.label}
            className="flex items-baseline justify-between gap-3 text-[13px]"
          >
            <span className="min-w-0 truncate text-muted">{s.label}</span>
            <span className="shrink-0 font-medium">{money(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Drill({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[13px]"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
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
