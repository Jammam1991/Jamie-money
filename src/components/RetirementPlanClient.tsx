"use client";

// The 401k Plan, Jamie's side. Chris sets the deal in Money App (what Jamie
// owes, the 401k share, the monthly payment) — those are shown, not edited.
// What Jamie saves on top, and the growth guess, are his to play with, and
// stay in this browser. Same look as Money App's divorce/retirement screen.

import { useEffect, useMemo, useState } from "react";
import PlanChart from "@/components/PlanChart";
import {
  resolveInputs,
  runPlan,
  type ContribMode,
  type PlanBase,
} from "@/lib/retirementPlan";

const STORAGE_KEY = "retirement-plan-savings-v1";

type Savings = {
  contribMode: ContribMode;
  contribMonthly: number;
  contribPct: number;
  yearlyPay: number;
  raisePct: number;
  returnPct: number;
};

const money = (n: number) =>
  Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "Mar 2036" for a month count from today. */
function monthFromNow(today: string, months: number): string {
  const [y, m] = today.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[total % 12]} ${Math.floor(total / 12)}`;
}

export default function RetirementPlanClient({ base }: { base: PlanBase }) {
  const start: Savings = {
    contribMode: base.settings.contribMode,
    contribMonthly: base.settings.contribMonthly,
    contribPct: base.settings.contribPct,
    yearlyPay: base.settings.yearlyPay,
    raisePct: base.settings.raisePct,
    returnPct: base.settings.returnPct,
  };
  const [sv, setSv] = useState<Savings>(start);
  const [loaded, setLoaded] = useState(false);

  // Read after mount — the server can't see this browser's saved choices.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of saved choices after mount
      if (saved) setSv((p) => ({ ...p, ...(JSON.parse(saved) as Partial<Savings>) }));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sv));
    } catch {}
  }, [sv, loaded]);

  const set = (patch: Partial<Savings>) => setSv((p) => ({ ...p, ...patch }));

  const inputs = useMemo(() => resolveInputs({ ...base.settings, ...sv }, base.live), [base, sv]);
  const r = useMemo(() => runPlan(inputs, base.asOf), [inputs, base.asOf]);
  const age = base.settings.retireAge;
  const ratio = r.totalLoanPaid > 0 ? r.withSavingsAtRetire / r.totalLoanPaid : 0;
  const savingNow = sv.contribMode === "dollars" ? sv.contribMonthly : (sv.yearlyPay * sv.contribPct) / 100 / 12;
  const barMax = Math.max(r.totalLoanPaid, r.withSavingsAtRetire);

  return (
    <div className="space-y-4">
      {/* The whole page in one line: what each dollar you pay turns into. */}
      <section
        className="relative overflow-hidden rounded-3xl border border-pos/25 p-6"
        style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--pos) 16%, var(--card)) 0%, var(--card) 70%)" }}
      >
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 sm:max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pos">When you turn {age}</p>
            {r.totalLoanPaid === 0 ? (
              <h2 className="text-3xl font-bold leading-tight tracking-tight">Nothing to pay back. The 401k is all yours.</h2>
            ) : (
              <h2 className="text-3xl font-bold leading-tight tracking-tight">
                Every $1 you pay Chris comes back to you as{" "}
                <span className={ratio >= 1 ? "text-pos" : "text-foreground"}>${ratio.toFixed(2)}</span>
              </h2>
            )}
            {r.totalLoanPaid > 0 && (
              <p className="text-sm text-muted">
                {ratio >= 1
                  ? `Paying Chris back is like saving for yourself, with ${money(r.withSavingsAtRetire - r.totalLoanPaid)} on top.`
                  : `Your 401k gets back ${Math.round(ratio * 100)}% of what you pay. Saving a little each month closes the gap.`}
              </p>
            )}
          </div>
          <Ring ratio={ratio} />
        </div>

        {r.totalLoanPaid > 0 && (
          <div className="mt-6 space-y-3">
            <Bar label="You pay Chris" value={r.totalLoanPaid} max={barMax} color="var(--neg)" />
            <Bar label={`Your 401k at ${age}`} value={r.withSavingsAtRetire} max={barMax} color="var(--pos)" />
          </div>
        )}
      </section>

      {/* The deal as three steps. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Step n={1} title="Chris gives you" value={money(inputs.fromChris)} sub="Part of his 401k, into your own" />
        <Step
          n={2}
          title="You pay Chris back"
          value={`${money(inputs.monthlyPayment)}/mo`}
          sub={
            r.payoffMonths === null
              ? "Not enough to ever pay it off"
              : `${money(inputs.jamieOwes)} in all, done ${monthFromNow(base.asOf, r.payoffMonths)}`
          }
        />
        <Step
          n={3}
          title={`At ${age} you have`}
          value={money(r.withSavingsAtRetire)}
          sub={`About ${money(r.monthlyIncomeWithSavings)} a month for life`}
          glow
        />
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <PlanChart points={r.points} />
      </div>

      {/* What's yours to play with, as sliders. */}
      <section className="rounded-3xl border border-border bg-card p-5 space-y-6">
        <h2 className="text-lg font-semibold">Play with it</h2>
        {sv.contribMode === "dollars" ? (
          <Slider
            label="You add each month"
            show={`${money(sv.contribMonthly)}/mo`}
            min={0}
            max={1000}
            step={25}
            value={sv.contribMonthly}
            onChange={(v) => set({ contribMonthly: v })}
            aside={<ModeSwitch mode="dollars" onSwitch={() => set({ contribMode: "percent" })} />}
          />
        ) : (
          <Slider
            label="You add from your pay"
            show={`${sv.contribPct}% · ${money(savingNow)}/mo`}
            min={0}
            max={20}
            step={1}
            value={sv.contribPct}
            onChange={(v) => set({ contribPct: v })}
            aside={<ModeSwitch mode="percent" onSwitch={() => set({ contribMode: "dollars" })} />}
          />
        )}
        <Slider
          label={sv.contribMode === "dollars" ? "Add more each year by" : "Your pay goes up each year by"}
          show={`${sv.raisePct}%`}
          min={0}
          max={10}
          step={0.5}
          value={sv.raisePct}
          onChange={(v) => set({ raisePct: v })}
        />
        {sv.contribMode === "percent" && (
          <Slider
            label="Your pay a year"
            show={money(sv.yearlyPay)}
            min={20000}
            max={200000}
            step={2500}
            value={sv.yearlyPay}
            onChange={(v) => set({ yearlyPay: v })}
          />
        )}
        <Slider
          label="401k grows each year"
          show={`${sv.returnPct}%`}
          min={2}
          max={10}
          step={0.5}
          value={sv.returnPct}
          onChange={(v) => set({ returnPct: v })}
        />
        <p className="text-xs text-muted">
          You put in {money(r.contributedTotal)} of your own by {age}. With growth it turns into{" "}
          <b className="text-pos">{money(r.withSavingsAtRetire - r.fromChrisAtRetire)}</b>.
        </p>
        <button type="button" onClick={() => setSv(start)} className="text-xs text-pos">
          Back to the starting numbers
        </button>
      </section>

      <details className="group rounded-2xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-medium">How this works</span>
          <span className="text-xs text-muted transition-transform group-open:rotate-90">&#9656;</span>
        </summary>
        <div className="space-y-2 px-5 pb-5 text-sm text-muted">
          <p>
            <b className="text-foreground">Guesses.</b> The 401k is guessed to grow {sv.returnPct}% a year. Markets go up and
            down; some years lose money.
          </p>
          <p>
            <b className="text-foreground">Before taxes.</b> 401k money is taxed when you take it out, so what you can spend is
            less.
          </p>
          <p>
            <b className="text-foreground">&ldquo;A month for life&rdquo;</b> means taking out 4% a year, which usually makes
            the money last.
          </p>
          <p>
            <b className="text-foreground">Starts from age {Math.floor(r.ageNow)}.</b> Worked out from today to your {age}th
            birthday.
          </p>
        </div>
      </details>
    </div>
  );
}

/** A ring that fills as your 401k catches up with what you pay. */
function Ring({ ratio }: { ratio: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const fill = Math.min(1, Math.max(0, ratio));
  return (
    <div className="relative h-32 w-32 shrink-0 self-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="color-mix(in srgb, var(--foreground) 8%, transparent)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--pos)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fill)}
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${ratio >= 1 ? "text-pos" : "text-foreground"}`}>
          {Math.round(ratio * 100)}%
        </span>
        <span className="text-[11px] text-muted">paid back</span>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">{money(value)}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--foreground) 7%, transparent)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / Math.max(1, max)) * 100}%`, background: color, transition: "width 500ms ease" }}
        />
      </div>
    </div>
  );
}

function Step({ n, title, value, sub, glow }: { n: number; title: string; value: string; sub: string; glow?: boolean }) {
  return (
    <div
      className="rounded-3xl border border-border bg-card p-5"
      style={glow ? { boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--pos) 45%, transparent)" } : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "color-mix(in srgb, var(--pos) 15%, transparent)", color: "var(--pos)" }}
        >
          {n}
        </span>
        <span className="text-sm text-muted">{title}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${glow ? "text-pos" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Slider({
  label,
  show,
  min,
  max,
  step,
  value,
  onChange,
  aside,
}: {
  label: string;
  show: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  aside?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-foreground">
          {label} {aside}
        </span>
        <span className="text-sm font-semibold tabular-nums text-pos">{show}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full cursor-pointer accent-pos"
      />
    </div>
  );
}

function ModeSwitch({ mode, onSwitch }: { mode: ContribMode; onSwitch: () => void }) {
  return (
    <button
      type="button"
      onClick={onSwitch}
      className="ml-1 rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted"
    >
      {mode === "dollars" ? "use % of pay" : "use $ a month"}
    </button>
  );
}
