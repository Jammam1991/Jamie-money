"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Car, Check, HeartPulse, Landmark, Pencil, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { setMarriageBenefits } from "@/lib/actions";
import {
  healthYearly,
  yearlyValue,
  type JointTaxSavings,
  type MarriageBenefits,
} from "@/lib/marriage";

// ── Married vs Divorce ───────────────────────────────────────────────────────
// Two halves, and the second one matters more than the first.
//
// The top half is the money: four things that only exist while the marriage
// does, three of them worth something every single year. The joint tax figure
// is real (read from the Tax Center feed); the rest are what Chris typed, and
// anything he hasn't typed says so rather than showing a made-up number.
//
// The bottom half answers the thing Jamie actually said — that the marriage is
// what ties the money together. Two reasons, and neither one survives a look:
// filing jointly is a choice that can be changed without a divorce, and a
// guarantee on a lease or a car loan isn't a marriage at all. A divorce doesn't
// untie any of it. It just deletes the top half of this page.

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";

export default function MarriedVsDivorceClient({
  benefits,
  jointTax,
  admin,
}: {
  benefits: MarriageBenefits;
  jointTax: JointTaxSavings;
  admin: boolean;
}) {
  const [data, setData] = useState<MarriageBenefits>(benefits);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <BenefitsForm
        initial={data}
        onCancel={() => setEditing(false)}
        onSaved={(next) => {
          setData(next);
          setEditing(false);
        }}
      />
    );
  }

  const value = yearlyValue(data, jointTax);

  return (
    <div className="space-y-3">
      {admin && (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
          onClick={() => setEditing(true)}
        >
          <Pencil size={15} />
          Edit the insurance numbers
        </button>
      )}

      <Hero value={value} />

      <JointTaxCard jointTax={jointTax} />
      <CarCard saving={data.carSavingYearly} />
      <LifeCard low={data.lifeCoverLow} high={data.lifeCoverHigh} />
      <HealthCard benefits={data} />

      <TiedTogether />
    </div>
  );
}

// ── The headline ─────────────────────────────────────────────────────────────

function Hero({ value }: { value: ReturnType<typeof yearlyValue> }) {
  const nothingYet = value.missing === 3;

  return (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: "var(--good-bg)", border: "1px solid var(--good)" }}
    >
      <p className="text-[13px] font-medium" style={{ color: "var(--good)" }}>
        💍 What staying married is worth
      </p>
      {nothingYet ? (
        <p className="mt-2 text-[14px] text-muted">
          None of the numbers are filled in yet. The four cards below say what
          each one is and what&apos;s still missing.
        </p>
      ) : (
        <>
          <p className="mt-1 text-3xl font-bold" style={{ color: "var(--good)" }}>
            {money(value.total)}
            <span className="text-[15px] font-medium"> a year</span>
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {value.missing > 0
              ? `And that's only counting ${3 - value.missing} of the 3 yearly savings — ${
                  value.missing === 1 ? "one isn't" : `${value.missing} aren't`
                } filled in yet, so the real figure is higher.`
              : "Money that stops the day the marriage does."}
          </p>
        </>
      )}
      <p className="mt-2 text-[11px] text-faint">
        The life cover below isn&apos;t in this total — it&apos;s a one-time
        payout, not money saved each year.
      </p>
    </div>
  );
}

// ── 1. The joint tax return ──────────────────────────────────────────────────

function JointTaxCard({ jointTax }: { jointTax: JointTaxSavings }) {
  return (
    <Benefit
      Icon={Landmark}
      title="Filing taxes together"
      plain="One return instead of two. Two single returns pay more tax on the same money — the brackets and the deduction are simply worse apart."
    >
      {jointTax.years.length === 0 ? (
        <Missing>
          {jointTax.error ??
            "No year has both numbers yet, so there's nothing to compare."}
        </Missing>
      ) : (
        <>
          <Amount
            value={jointTax.perYear ?? 0}
            unit="a year, on average"
            note={`Across ${jointTax.years.length} ${
              jointTax.years.length === 1 ? "year" : "years"
            } — ${money(jointTax.total)} saved altogether.`}
          />

          <div className="mt-3 space-y-1">
            {jointTax.years.map((y) => (
              <div
                key={y.year}
                className="flex items-baseline justify-between text-[13px]"
              >
                <span className="text-muted">{y.year}</span>
                <span
                  className="font-medium"
                  style={{ color: y.saved >= 0 ? "var(--good)" : "var(--neg)" }}
                >
                  {y.saved >= 0
                    ? `${money(y.saved)} saved`
                    : `${money(Math.abs(y.saved))} worse`}
                </span>
              </div>
            ))}
          </div>

          <Link
            href="/tax-center"
            className="mt-3 inline-block text-[13px] font-medium text-blue-600 hover:underline"
          >
            See the years in full →
          </Link>
        </>
      )}
      <p className="mt-3 text-[11px] text-faint">
        These come from the Money App, comparing the tax filed together against
        what the same year would have cost as two single returns. Rough
        estimates, not the filed returns.
      </p>
    </Benefit>
  );
}

// ── 2. Car insurance ─────────────────────────────────────────────────────────

function CarCard({ saving }: { saving: number | null }) {
  return (
    <Benefit
      Icon={Car}
      title="The car insurance discount"
      plain="Two married people on one policy is cheaper than two people buying their own. Split up, both policies go back to full price."
    >
      {saving == null ? (
        <Missing>
          Chris hasn&apos;t put the number in yet — it&apos;s the difference
          between what the policy costs now and what two separate ones would.
        </Missing>
      ) : (
        <Amount
          value={saving}
          unit="a year"
          note={`About ${money(Math.round(saving / 12))} a month.`}
        />
      )}
    </Benefit>
  );
}

// ── 3. Life insurance ────────────────────────────────────────────────────────

function LifeCard({ low, high }: { low: number | null; high: number | null }) {
  const range =
    low != null && high != null && high > low
      ? `${money(low)} – ${money(high)}`
      : low != null
        ? money(low)
        : high != null
          ? money(high)
          : null;

  return (
    <Benefit
      Icon={ShieldCheck}
      title="Life insurance"
      plain="If something happens to Chris, this is what comes to Jamie. A spouse is covered by it; an ex-spouse isn't."
    >
      {range == null ? (
        <Missing>The cover amount isn&apos;t filled in yet.</Missing>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--good)" }}>
            {range}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Paid once, if it&apos;s ever needed. It isn&apos;t a yearly saving,
            which is why it&apos;s kept out of the total at the top.
          </p>
        </>
      )}
    </Benefit>
  );
}

// ── 4. Health insurance ──────────────────────────────────────────────────────

function HealthCard({ benefits }: { benefits: MarriageBenefits }) {
  const yearly = healthYearly(benefits);
  const pct = benefits.healthEmployerPct;
  const premium = benefits.healthPremiumMonthly;

  return (
    <Benefit
      Icon={HeartPulse}
      title="Health insurance through Comerica"
      plain={
        pct == null
          ? "Chris's employer pays most of the cost of covering Jamie. A spouse can be on that plan. An ex-spouse can't — the whole premium becomes Jamie's to pay."
          : `Chris's employer pays ${pct}% of the cost of covering Jamie. A spouse can be on that plan. An ex-spouse can't — the whole premium becomes Jamie's to pay.`
      }
    >
      {yearly == null || premium == null ? (
        <Missing>
          The monthly premium isn&apos;t filled in yet, so there&apos;s no dollar
          figure to put on Comerica&apos;s share.
        </Missing>
      ) : (
        <>
          <Amount
            value={yearly}
            unit="a year"
            note={`Comerica's ${pct}% of the ${money(premium)} monthly premium.`}
          />

          {/* The split, drawn — who pays which part of one month's premium. */}
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-tint">
            <div style={{ width: `${pct}%`, background: "var(--good)" }} />
            <div style={{ width: `${100 - (pct ?? 0)}%`, background: "var(--warn)" }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <Key
              color="var(--good)"
              label="Comerica pays"
              value={money(Math.round(premium * ((pct ?? 0) / 100)))}
            />
            <Key
              color="var(--warn)"
              label="You pay"
              value={money(Math.round(premium * (1 - (pct ?? 0) / 100)))}
            />
          </div>
          {/* A template literal, not JSX text — JSX trims the whitespace at
              both ends of a wrapped line, which silently glued the amount to
              the word after it ("$620a month"). */}
          <p className="mt-2 text-[12px] text-muted">
            {`After a divorce the green part goes away and the whole ${money(
              premium
            )} a month is Jamie's.`}
          </p>
        </>
      )}
    </Benefit>
  );
}

// ── The part that isn't about money ──────────────────────────────────────────
// Jamie's own reason for feeling tied, taken seriously and answered.

function TiedTogether() {
  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-lg font-medium">
        &ldquo;But the marriage is what ties our money together&rdquo;
      </h2>
      <p className="text-[14px] text-muted">
        That&apos;s the real reason this comes up, so here it is straight. There
        are two things behind that feeling. Neither one is the marriage.
      </p>

      <Reason
        n={1}
        claim="We file our taxes together."
        answer="True — but filing together is a choice, not a rule of being married. Married people are allowed to file separately: two returns, two refunds, nothing shared. It costs more in tax, which is exactly the saving shown at the top of this page. The point is it can be changed with a form, not a divorce."
      />

      <Reason
        n={2}
        claim="Chris guarantees my apartment and my car, so he's tied to my money."
        answer="Also true — and this is the one that actually ties the money together. But a guarantee is a signature on a lease and on a car loan. It isn't a marriage. Getting divorced tomorrow would not remove Chris's name from either one; the lease and the loan would sit there exactly as they are."
      />

      <Card>
        <p className="text-[15px] font-semibold">
          <span className="mr-1.5">🔓</span>
          The only three ways off a guarantee
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Every one of them is about qualifying on your own income. None of them
          involve the marriage.
        </p>
        <div className="mt-3 space-y-2">
          <Way
            n={1}
            title="A cheaper apartment"
            body="Low enough rent that the landlord approves Jamie on his own, with no co-signer."
          />
          <Way
            n={2}
            title="A cheaper car"
            body="A smaller loan Jamie can be approved for by himself, or one that's paid off."
          />
          <Way
            n={3}
            title="Make the business profitable"
            body="Enough steady income of his own that Jamie qualifies for the apartment and the car he already has. This is the one that keeps everything as it is."
          />
        </div>
      </Card>

      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--warn-bg)", border: "1px solid var(--warn)" }}
      >
        <p className="text-[15px] font-semibold" style={{ color: "var(--warn)" }}>
          So what would a divorce actually change?
        </p>
        <p className="mt-2 text-[14px]">
          The guarantees stay. The lease stays. The car loan stays. The debt
          stays. Everything on this page&apos;s top half — the tax saving, the
          car discount, the life cover, the health insurance — goes away.
        </p>
        <p className="mt-2 text-[14px] font-medium">
          It doesn&apos;t untie the money. It only deletes the benefits.
        </p>
      </div>
    </div>
  );
}

function Reason({ n, claim, answer }: { n: number; claim: string; answer: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: "var(--muted)" }}
        >
          {n}
        </span>
        <div>
          <p className="text-[15px] font-semibold">&ldquo;{claim}&rdquo;</p>
          <p className="mt-1.5 text-[14px] text-muted">{answer}</p>
        </div>
      </div>
    </Card>
  );
}

function Way({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-tint p-3">
      <p className="text-[14px] font-semibold">
        {n}. {title}
      </p>
      <p className="mt-0.5 text-[13px] text-muted">{body}</p>
    </div>
  );
}

// ── Small shared pieces ──────────────────────────────────────────────────────

function Benefit({
  Icon,
  title,
  plain,
  children,
}: {
  Icon: typeof Car;
  title: string;
  plain: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color: "var(--good)" }} />
        <p className="text-[15px] font-semibold">{title}</p>
      </div>
      <p className="mt-1.5 text-[13px] text-muted">{plain}</p>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

function Amount({
  value,
  unit,
  note,
}: {
  value: number;
  unit: string;
  note?: string;
}) {
  return (
    <>
      <p className="text-2xl font-semibold" style={{ color: "var(--good)" }}>
        {money(value)}
        <span className="text-[13px] font-normal text-muted"> {unit}</span>
      </p>
      {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
    </>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-tint p-3 text-[13px] text-muted">{children}</p>;
}

function Key({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

// ── Chris's boxes ────────────────────────────────────────────────────────────
// The joint tax saving isn't here — that one is read from the Money App, so
// there's nothing to type and nothing to keep in sync.

function BenefitsForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: MarriageBenefits;
  onCancel: () => void;
  onSaved: (next: MarriageBenefits) => void;
}) {
  const [car, setCar] = useState(initial.carSavingYearly?.toString() ?? "");
  const [low, setLow] = useState(initial.lifeCoverLow?.toString() ?? "");
  const [high, setHigh] = useState(initial.lifeCoverHigh?.toString() ?? "");
  const [premium, setPremium] = useState(
    initial.healthPremiumMonthly?.toString() ?? ""
  );
  const [pct, setPct] = useState(initial.healthEmployerPct?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toNumber(v: string): number | null {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/[$,%]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function save() {
    const next: MarriageBenefits = {
      carSavingYearly: toNumber(car),
      lifeCoverLow: toNumber(low),
      lifeCoverHigh: toNumber(high),
      healthPremiumMonthly: toNumber(premium),
      healthEmployerPct: toNumber(pct),
    };
    setError(null);
    startTransition(async () => {
      const res = await setMarriageBenefits(next);
      if (res.ok) onSaved(next);
      else setError(res.error ?? "Couldn't save.");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Leave a box empty and the page says that number isn&apos;t filled in yet,
        rather than counting it as zero.
      </p>

      <Card>
        <p className="mb-2 text-[15px] font-semibold">🚗 Car insurance</p>
        <Field
          label="What the married discount saves, per year"
          value={car}
          onChange={setCar}
          placeholder="e.g. 900"
        />
      </Card>

      <Card>
        <p className="mb-2 text-[15px] font-semibold">🛡️ Life insurance</p>
        <Field
          label="Cover — the low end"
          value={low}
          onChange={setLow}
          placeholder="e.g. 200000"
        />
        <div className="mt-3">
          <Field
            label="Cover — the high end"
            value={high}
            onChange={setHigh}
            placeholder="e.g. 300000"
            hint="Leave empty if it's one fixed amount rather than a range."
          />
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-[15px] font-semibold">❤️ Health insurance</p>
        <Field
          label="The full monthly premium for Jamie's cover"
          value={premium}
          onChange={setPremium}
          placeholder="e.g. 600"
          hint="Before Comerica's share — the whole cost of covering him."
        />
        <div className="mt-3">
          <Field
            label="The percent Comerica pays"
            value={pct}
            onChange={setPct}
            placeholder="e.g. 75"
          />
        </div>
      </Card>

      {error && <p className="text-[13px] text-warn">{error}</p>}

      <div className="flex justify-end gap-2">
        <button className="rounded-lg px-3 py-2 text-sm text-muted" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--good)" }}
          onClick={save}
          disabled={pending}
        >
          <Check size={16} />
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[13px] text-muted">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        className={inputClass + " mt-1"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-[12px] text-faint">{hint}</p>}
    </div>
  );
}
