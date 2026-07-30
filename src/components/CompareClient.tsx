"use client";

import { useSyncExternalStore } from "react";
import { Briefcase, Building2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";

// The employee's half of payroll tax (Social Security + Medicare). It comes out
// of every W-2 paycheck no matter what, and it's a big reason a job has to pay
// more than a business distribution to leave you in the same spot.
const PAYROLL_TAX = 0.0765;
// 40 hours x 52 weeks — just for the "per hour" gut check.
const WORK_HOURS_PER_YEAR = 2080;

// Jamie's numbers live on his own phone. Nothing to save on a server.
const STORAGE_KEY = "jm-compare-v1";

type Inputs = {
  distribution: string;
  bizTaxRate: string;
  bizPerks: string;
  bizGrowth: string;
  jobTaxRate: string;
  jobMatch: string;
  jobHealth: string;
  jobOffer: string;
};

// Sensible starting numbers so the page shows a real answer before he touches
// anything. He can change every one of them.
const DEFAULTS: Inputs = {
  distribution: "100000",
  bizTaxRate: "25",
  bizPerks: "6000",
  bizGrowth: "10000",
  jobTaxRate: "22",
  jobMatch: "4",
  jobHealth: "7000",
  jobOffer: "",
};

// Jamie's numbers are kept in localStorage so they're still there next time.
// This little store hands them to React through useSyncExternalStore, which
// keeps the server's render (the defaults) from fighting the saved values.
let cached: Inputs | null = null;
let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getInputs(): Inputs {
  if (cached) return cached;
  let loaded = DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) loaded = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // First visit, or storage is switched off — the defaults are fine.
  }
  cached = loaded;
  return loaded;
}

function getServerInputs(): Inputs {
  return DEFAULTS;
}

function saveInputs(next: Inputs) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do if the phone won't let us save. The math still works.
  }
  listeners.forEach((l) => l());
}

function num(s: string): number {
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// A percent typed as "25" becomes 0.25. Capped at 95% so the math can't blow up.
function pct(s: string): number {
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, 95) / 100;
}

function compare(i: Inputs) {
  const distribution = num(i.distribution);
  const perks = num(i.bizPerks);
  const growth = num(i.bizGrowth);
  const health = num(i.jobHealth);

  // Business side: what he keeps after tax, plus everything the business hands
  // him that a paycheck wouldn't.
  const afterTax = distribution * (1 - pct(i.bizTaxRate));
  const businessValue = afterTax + perks + growth;

  // Job side: what one dollar of salary is actually worth to him once income
  // tax and payroll tax come out and the employer's match goes back in.
  const keptPerDollar = 1 - pct(i.jobTaxRate) - PAYROLL_TAX + pct(i.jobMatch);
  const solvable = keptPerDollar > 0.01;

  // Health insurance the job pays for is free money, so it lowers the salary
  // he needs. Everything else has to come out of the salary itself.
  const needed = solvable
    ? Math.max(0, (businessValue - health) / keptPerDollar)
    : 0;

  // Optional: a real offer, scored the same way so it's apples to apples.
  const offer = num(i.jobOffer);
  const offerValue = offer > 0 ? offer * keptPerDollar + health : 0;

  return {
    distribution,
    afterTax,
    perks,
    growth,
    businessValue,
    health,
    keptPerDollar,
    solvable,
    needed,
    offer,
    offerValue,
  };
}

export default function CompareClient() {
  const inputs = useSyncExternalStore(subscribe, getInputs, getServerInputs);

  const set = (key: keyof Inputs) => (value: string) =>
    saveInputs({ ...inputs, [key]: value });

  const r = compare(inputs);
  const offerDiff = r.offerValue - r.businessValue;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Put in what the business pays you, and this shows what a regular job
        would have to pay to leave you just as well off.
      </p>

      {/* The answer, up top, before any of the knobs. */}
      <div className="rounded-2xl bg-good-bg p-5 text-center">
        <p className="text-[15px] font-medium text-good">
          💼 A job would have to pay you
        </p>
        {r.solvable ? (
          <>
            <p className="mt-1 text-5xl font-bold text-good">
              {money(r.needed)}
            </p>
            <p className="mt-1 text-[13px] text-good">
              a year · {money(r.needed / 12)} a month ·{" "}
              {money(r.needed / WORK_HOURS_PER_YEAR)} an hour
            </p>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-good">
            Those job tax numbers eat the whole paycheck — lower the tax rate to
            see an answer.
          </p>
        )}
      </div>

      {/* Business side. */}
      <Card>
        <p className="mb-1 flex items-center gap-2 text-[13px] font-medium text-muted">
          <Building2 size={16} />
          The business
        </p>
        <Row
          label="Profit you take out"
          hint="Your distribution for the year"
          prefix="$"
          value={inputs.distribution}
          onChange={set("distribution")}
        />
        <Row
          label="Tax you pay on it"
          hint="Your business tax rate"
          suffix="%"
          value={inputs.bizTaxRate}
          onChange={set("bizTaxRate")}
        />
        <Row
          label="Stuff the business pays for"
          hint="Phone, car, insurance, meals — a year"
          prefix="$"
          value={inputs.bizPerks}
          onChange={set("bizPerks")}
        />
        <Row
          label="What it's building for you"
          hint="Value the business gains each year"
          prefix="$"
          value={inputs.bizGrowth}
          onChange={set("bizGrowth")}
        />
      </Card>

      {/* Job side. */}
      <Card>
        <p className="mb-1 flex items-center gap-2 text-[13px] font-medium text-muted">
          <Briefcase size={16} />
          The job
        </p>
        <Row
          label="Tax on a paycheck"
          hint="Income tax only — payroll tax is added for you"
          suffix="%"
          value={inputs.jobTaxRate}
          onChange={set("jobTaxRate")}
        />
        <Row
          label="401(k) match"
          hint="What the boss chips in, as a % of pay"
          suffix="%"
          value={inputs.jobMatch}
          onChange={set("jobMatch")}
        />
        <Row
          label="Health insurance they cover"
          hint="What they pay for you — a year"
          prefix="$"
          value={inputs.jobHealth}
          onChange={set("jobHealth")}
        />
      </Card>

      {/* Plain-English math, so the big number isn't a black box. */}
      <Card>
        <p className="mb-1.5 text-[13px] text-muted">How we got that number</p>
        <Line
          label="Profit after your business tax"
          value={money(r.afterTax)}
        />
        <Line label="Stuff the business pays for" value={`+ ${money(r.perks)}`} />
        <Line label="What it's building for you" value={`+ ${money(r.growth)}`} />
        <Line
          label="The business is worth"
          value={money(r.businessValue)}
          bold
        />
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-[13px] text-muted">
            On a paycheck you keep about{" "}
            <span className="font-medium text-text">
              {Math.round(Math.max(0, r.keptPerDollar) * 100)}¢
            </span>{" "}
            of every dollar after {inputs.jobTaxRate || 0}% income tax and 7.65%
            payroll tax, plus the {inputs.jobMatch || 0}% match. The job&apos;s
            health insurance ({money(r.health)}) counts toward it too — so you&apos;d
            need{" "}
            <span className="font-medium text-text">
              {r.solvable ? money(r.needed) : "—"}
            </span>{" "}
            in salary.
          </p>
        </div>
      </Card>

      {/* Optional gut check against a real number someone offered him. */}
      <Card>
        <p className="mb-1 text-[13px] text-muted">Got a real job offer?</p>
        <Row
          label="They'd pay me"
          hint="Leave blank to skip"
          prefix="$"
          value={inputs.jobOffer}
          onChange={set("jobOffer")}
        />
        {r.offer > 0 && r.solvable && (
          <div
            className="mt-2 rounded-xl p-3 text-[15px]"
            style={
              // Green when the business wins — nothing to change. Amber when a
              // job would beat it, because that's the one worth thinking about.
              offerDiff >= 0
                ? { background: "var(--warn-bg)", color: "var(--warn)" }
                : { background: "var(--good-bg)", color: "var(--good)" }
            }
          >
            {offerDiff >= 0 ? (
              <>
                🤔 That job would be{" "}
                <span className="font-semibold">{money(offerDiff)}</span> a year
                better than the business.
              </>
            ) : (
              <>
                🏆 The business is worth{" "}
                <span className="font-semibold">{money(-offerDiff)}</span> a year
                more than that job.
              </>
            )}
          </div>
        )}
      </Card>

      <button
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
        onClick={() => saveInputs(DEFAULTS)}
      >
        <RotateCcw size={15} />
        Start over
      </button>

      <p className="pb-2 text-[12px] text-muted">
        A rough estimate to help you think, not tax advice. Payroll tax is
        figured at a flat 7.65%, and real taxes depend on a lot more. Check with
        your accountant before making a big call.
      </p>
    </div>
  );
}

// One labeled input row — label on the left, a small number box on the right.
function Row({
  label,
  hint,
  prefix,
  suffix,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[15px]">{label}</p>
        {hint && <p className="text-[12px] text-muted">{hint}</p>}
      </div>
      <div className="relative w-[118px] shrink-0">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          className={
            "w-full rounded-lg border border-border bg-card py-2 text-right text-[15px] outline-none focus:border-[var(--muted)] " +
            (prefix ? "pl-6 " : "pl-2 ") +
            (suffix ? "pr-7" : "pr-2")
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// One line of the breakdown.
function Line({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={
        "flex justify-between border-t border-border py-2 text-[15px] first:border-t-0 " +
        (bold ? "font-semibold" : "")
      }
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
