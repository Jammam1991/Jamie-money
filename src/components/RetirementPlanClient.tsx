"use client";

// The 401k Plan, Jamie's side. Chris sets the deal in Money App (what Jamie
// owes, the 401k share, the monthly payment) — those are shown, not edited.
// What Jamie saves on top is his to play with, and stays in this browser.

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
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
};

const INPUT =
  "w-full bg-transparent py-2 text-sm text-foreground outline-none";

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

  const set = <K extends keyof Savings>(k: K, v: Savings[K]) => setSv((p) => ({ ...p, [k]: v }));

  const inputs = useMemo(() => resolveInputs({ ...base.settings, ...sv }, base.live), [base, sv]);
  const r = useMemo(() => runPlan(inputs, base.asOf), [inputs, base.asOf]);
  const age = base.settings.retireAge;
  const extra = r.fromChrisAtRetire - r.totalLoanPaid;
  const totalExtra = r.withSavingsAtRetire - r.totalLoanPaid;
  const savingsGrown = r.withSavingsAtRetire - r.fromChrisAtRetire;
  const savingNow = sv.contribMode === "dollars" ? sv.contribMonthly : (sv.yearlyPay * sv.contribPct) / 100 / 12;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="You owe Chris" value={money(inputs.jamieOwes)} sub="Paid back a bit each month" tone="neg" />
        <Tile label="Chris puts in your 401k" value={money(inputs.fromChris)} sub="Your share of his 401k, yours to keep" tone="pos" />
        <Tile
          label="You pay each month"
          value={money(inputs.monthlyPayment)}
          sub={r.payoffMonths === null ? "Not enough to ever pay it off" : `All paid off by ${monthFromNow(base.asOf, r.payoffMonths)}`}
          tone="plain"
        />
      </div>

      {/* Every number you can change moves at least one of these three — your
          own savings included. They used to feed only a grey line underneath,
          so changing a % looked like it did nothing. */}
      <div className="rounded-2xl border px-4 py-4 space-y-3" style={{ borderColor: "var(--good)", background: "var(--good-bg)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">When you turn {age}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Big label="You paid Chris in all" value={money(r.totalLoanPaid)} sub={`${money(inputs.monthlyPayment)} a month`} tone="neg" />
          <Big
            label="Your 401k"
            value={money(r.withSavingsAtRetire)}
            sub={`${money(r.fromChrisAtRetire)} from Chris's share + ${money(savingsGrown)} from your savings`}
            tone="pos"
          />
          <Big label="Could pay you for life" value={`${money(r.monthlyIncomeWithSavings)}/mo`} sub="Taking out 4% a year" tone="plain" />
        </div>
        <p className="text-base">
          {r.totalLoanPaid === 0 ? (
            "Nothing to pay back, so the 401k is all yours."
          ) : totalExtra >= 0 ? (
            <>
              Every payment you make comes back to you in your 401k — <b className="text-pos">plus {money(totalExtra)}</b>.
              Think of each payment as going into your own savings.
            </>
          ) : (
            <>
              Your 401k gives back <b>{Math.round((r.withSavingsAtRetire / r.totalLoanPaid) * 100)}%</b> of what you pay Chris.
            </>
          )}
        </p>
        {r.totalLoanPaid > 0 && (
          <p className="text-sm text-muted">
            Chris&apos;s share alone grows to {money(r.fromChrisAtRetire)}
            {extra >= 0 ? ` — more than all you pay him, by ${money(extra)}` : ` — ${Math.round(r.coverage * 100)}% of what you pay him`}.
          </p>
        )}
      </div>

      <Card>
        <PlanChart points={r.points} />
      </Card>

      <Card className="space-y-3">
        <p className="text-[15px] font-medium">What you add each month</p>
        <div className="flex gap-2">
          {(["dollars", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set("contribMode", m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                sv.contribMode === m ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted"
              }`}
            >
              {m === "dollars" ? "$ a month" : "% of my pay"}
            </button>
          ))}
        </div>
        {sv.contribMode === "dollars" ? (
          <Num label="I add each month" prefix="$" value={sv.contribMonthly} onChange={(v) => set("contribMonthly", v)} />
        ) : (
          <>
            <Num label="Share of my pay" suffix="%" value={sv.contribPct} onChange={(v) => set("contribPct", v)} />
            <Num label="My pay a year" prefix="$" value={sv.yearlyPay} onChange={(v) => set("yearlyPay", v)} />
          </>
        )}
        <Num
          label={sv.contribMode === "dollars" ? "Add more each year by" : "My pay goes up each year by"}
          suffix="%"
          value={sv.raisePct}
          onChange={(v) => set("raisePct", v)}
        />
        <p className="text-xs text-muted">
          That&apos;s <b className="text-foreground">{money(savingNow)} a month</b> now. You put in {money(r.contributedTotal)} of your
          own by {age}; with growth it turns into {money(savingsGrown)}.
        </p>
        <button type="button" onClick={() => setSv(start)} className="text-xs text-accent">
          Back to the starting numbers
        </button>
      </Card>

      <Card className="space-y-2 text-sm">
        <p className="text-[15px] font-medium">Good to know</p>
        <p className="text-muted">
          <b className="text-foreground">These are guesses.</b> The 401k is guessed to grow {base.settings.returnPct}% a year.
          Markets go up and down — some years lose money.
        </p>
        <p className="text-muted">
          <b className="text-foreground">Before taxes.</b> 401k money is taxed when you take it out, so what you can spend is
          less than these numbers.
        </p>
        <p className="text-muted">
          <b className="text-foreground">&ldquo;A month for life&rdquo;</b> uses the common rule of taking out 4% a year, which
          usually makes the money last.
        </p>
        <p className="text-muted">
          <b className="text-foreground">Starts from age {Math.floor(r.ageNow)}.</b> The numbers above are worked out from today
          to your {age}th birthday.
        </p>
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "pos" | "neg" | "plain" }) {
  const color = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-foreground";
  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </Card>
  );
}

function Big({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "pos" | "neg" | "plain" }) {
  const color = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-foreground";
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-surface px-3 focus-within:ring-1 focus-within:ring-accent">
        {prefix && <span className="mr-1 text-sm text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(e.target.value === "" || !Number.isFinite(n) ? 0 : n);
          }}
          className={INPUT}
        />
        {suffix && <span className="ml-1 whitespace-nowrap text-sm text-muted">{suffix}</span>}
      </div>
    </label>
  );
}
