"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, Tint } from "@/components/ui";
import { money } from "@/lib/data";
import { setHomeBuying } from "@/lib/actions";
import {
  DEFAULT_HOME_BUYING,
  DEFAULT_RATE_PCT,
  NATIONAL_PROPERTY_TAX_PCT,
  PMI_THRESHOLD_PCT,
  STATE_NAMES,
  homeBuyingMath,
  listingLinks,
  type HomeBuyingInputs,
} from "@/lib/homeBuying";

// Every box holds text, not a number, so a half-typed "6." doesn't get snapped
// back to 6 under his fingers. The maths reads through `n()` instead.
type Draft = Record<keyof HomeBuyingInputs, string>;

function toDraft(i: HomeBuyingInputs): Draft {
  return {
    yearlyMassage: String(i.yearlyMassage),
    taxPct: String(i.taxPct),
    place: i.place,
    downPct: String(i.downPct),
    ratePct: String(i.ratePct),
    years: String(i.years),
    cardPayments: String(i.cardPayments),
    carPayment: String(i.carPayment),
    otherPayments: String(i.otherPayments),
    dtiPct: String(i.dtiPct),
    propertyTaxPct: i.propertyTaxPct === null ? "" : String(i.propertyTaxPct),
    insurancePct: String(i.insurancePct),
    pmiPct: String(i.pmiPct),
    hoaMonthly: String(i.hoaMonthly),
  };
}

function n(v: string, fallback = 0): number {
  const parsed = Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toInputs(d: Draft): HomeBuyingInputs {
  const pinned = d.propertyTaxPct.trim();
  return {
    yearlyMassage: n(d.yearlyMassage),
    taxPct: n(d.taxPct),
    place: d.place,
    downPct: n(d.downPct),
    ratePct: n(d.ratePct),
    years: n(d.years, 30) || 30,
    cardPayments: n(d.cardPayments),
    carPayment: n(d.carPayment),
    otherPayments: n(d.otherPayments),
    dtiPct: n(d.dtiPct),
    propertyTaxPct: pinned === "" ? null : n(pinned),
    insurancePct: n(d.insurancePct),
    pmiPct: n(d.pmiPct),
    hoaMonthly: n(d.hoaMonthly),
  };
}

export default function HomeBuyingClient({ initial }: { initial: HomeBuyingInputs }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Draft) => (value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const inputs = useMemo(() => toInputs(draft), [draft]);
  const result = useMemo(() => homeBuyingMath(inputs), [inputs]);
  const best = result.afterTax;
  const links = useMemo(
    () => listingLinks(inputs.place, best.homeValue),
    [inputs.place, best.homeValue],
  );

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await setHomeBuying(inputs);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Couldn't save.");
    });
  };

  const reset = () => {
    setSaved(false);
    setError(null);
    setDraft(toDraft({ ...DEFAULT_HOME_BUYING, place: inputs.place }));
  };

  const placeLabel = result.stateCode
    ? STATE_NAMES[result.stateCode]
    : inputs.place.trim()
      ? null
      : "";

  return (
    <div className="space-y-6">
      {/* ── The answer, before any of the working ──────────────────────────── */}
      <Card>
        <div className="text-[13px] text-muted">The most house you could buy</div>
        <div className="mt-1 text-4xl font-bold" style={{ color: "var(--good)" }}>
          {money(best.homeValue)}
        </div>
        {best.homeValue > 0 ? (
          <>
            <div className="mt-1 text-[13px] text-muted">
              on a {money(best.loan)} mortgage, with {money(best.downPayment)} of
              your own money down.
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Biggest mortgage" value={money(best.loan)} />
              <Stat label="Cash you'd need up front" value={money(best.downPayment)} />
              <Stat label="House payment, per month" value={money(best.monthlyTotal)} />
              <Stat
                label="Everything you owe, per month"
                value={money(best.monthlyTotal + best.existingDebt)}
              />
            </div>
          </>
        ) : (
          <div className="mt-2 text-[14px]">
            Nothing, yet. {shortfallLine(best.shortfall, best.ceiling)}
          </div>
        )}
      </Card>

      {/* ── Step 1: the money in ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Step 1 — what massage brings in</h2>
        <p className="mb-3 text-[13px] text-muted">
          Put in what you think you can earn from massage over the next 12 months.
          The taxman takes a slice before any of it counts.
        </p>
        <Card>
          <div className="space-y-4">
            <Field
              label="Massage money over the next 12 months"
              prefix="$"
              value={draft.yearlyMassage}
              onChange={set("yearlyMassage")}
              placeholder="60000"
              hint="Before tax — the whole amount that comes in."
            />
            <Field
              label="Tax on that"
              suffix="%"
              value={draft.taxPct}
              onChange={set("taxPct")}
              placeholder="20"
              hint="Self-employed work usually loses about a fifth to income tax and self-employment tax."
            />

            <Tint>
              <Row label="Comes in" value={money(result.grossYear)} />
              <Row
                label={`Tax takes (${inputs.taxPct}%)`}
                value={`− ${money(result.taxTaken)}`}
                tone="neg"
              />
              <Row label="You actually keep" value={money(result.netYear)} strong />
              <Row
                label="Which is, per month"
                value={money(result.netMonth)}
                muted
              />
            </Tint>
          </div>
        </Card>
      </section>

      {/* ── Step 2: what the lender has room for ────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Step 2 — how much a lender allows</h2>
        <p className="mb-3 text-[13px] text-muted">
          A lender caps everything you owe each month at a share of what you earn.
          That cap is called DTI. The car and the cards come out of it first, and
          whatever is left is what you get to spend on a house.
        </p>
        <Card>
          <Tint>
            <Row label="Your money, per month" value={money(result.netMonth)} />
            <Row
              label={`The cap (${inputs.dtiPct}% of it)`}
              value={money(best.ceiling)}
            />
            <Row
              label="Credit cards already take"
              value={`− ${money(inputs.cardPayments)}`}
              tone="neg"
            />
            <Row
              label="The car already takes"
              value={`− ${money(inputs.carPayment)}`}
              tone="neg"
            />
            {inputs.otherPayments > 0 && (
              <Row
                label="Other payments take"
                value={`− ${money(inputs.otherPayments)}`}
                tone="neg"
              />
            )}
            <Row
              label="Left for a house, per month"
              value={money(best.housingBudget)}
              strong
            />
          </Tint>

          {best.shortfall > 0 && (
            <p className="mt-3 text-[13px] text-neg">
              {shortfallLine(best.shortfall, best.ceiling)}
            </p>
          )}

          <p className="mt-3 text-[12px] text-muted">
            Worth knowing: a lender doesn&apos;t actually look at your take-home —
            it looks at the profit on your tax return, before income tax. On that
            reading the same cap stretches to{" "}
            <strong>{money(result.beforeTax.homeValue)}</strong> of house. This
            page shows the careful number, not that one.
          </p>
        </Card>
      </section>

      {/* ── Step 3: what the payment is made of ─────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Step 3 — what that payment buys</h2>
        <p className="mb-3 text-[13px] text-muted">
          A house payment isn&apos;t just the loan. Four or five things share the
          same cheque, and only the first one is actually paying for the house.
        </p>
        <Card>
          <Tint>
            <Row label="Loan and interest" value={money(best.monthlyPI)} />
            <Row
              label={`Property tax (${result.taxRatePct.toFixed(2)}% a year${placeLabel ? ` — ${placeLabel}` : ""})`}
              value={money(best.monthlyTax)}
            />
            <Row label="Home insurance" value={money(best.monthlyInsurance)} />
            {best.usingPmi && (
              <Row label="Mortgage insurance (PMI)" value={money(best.monthlyPmi)} />
            )}
            {inputs.hoaMonthly > 0 && (
              <Row label="Association dues" value={money(best.monthlyHoa)} />
            )}
            <Row label="The whole payment" value={money(best.monthlyTotal)} strong />
          </Tint>

          {best.usingPmi && (
            <p className="mt-3 text-[13px] text-muted">
              You&apos;re putting down {inputs.downPct}%, which is under{" "}
              {PMI_THRESHOLD_PCT}%, so the lender charges mortgage insurance on
              top. It protects them, not you, and it usually falls away once
              you&apos;ve paid the loan down to 80% of what the house is worth.
            </p>
          )}
          {!result.stateCode && inputs.place.trim() === "" && (
            <p className="mt-3 text-[13px] text-muted">
              No town typed in yet, so the property tax is the national average of{" "}
              {NATIONAL_PROPERTY_TAX_PCT}%. Put a ZIP code in below and it&apos;ll
              use that state instead.
            </p>
          )}
          {!result.stateCode && inputs.place.trim() !== "" && (
            <p className="mt-3 text-[13px] text-muted">
              Couldn&apos;t work out the state from &quot;{inputs.place.trim()}&quot;,
              so this is the national average of {NATIONAL_PROPERTY_TAX_PCT}%. Try
              a ZIP code, or type the property tax rate in yourself.
            </p>
          )}
        </Card>
      </section>

      {/* ── The knobs ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Change anything</h2>
        <p className="mb-3 text-[13px] text-muted">
          Every number above comes from a box below. Move one and the whole page
          moves with it.
        </p>
        <Card>
          <div className="space-y-4">
            <Field
              label="Where you'd buy"
              value={draft.place}
              onChange={set("place")}
              placeholder="ZIP code, or Town, ST"
              hint={
                result.stateCode
                  ? `Reading that as ${STATE_NAMES[result.stateCode]}.`
                  : "Used to guess the property tax and to search for houses."
              }
            />
            <Field
              label="Deposit"
              suffix="%"
              value={draft.downPct}
              onChange={set("downPct")}
              placeholder="4"
              hint={`${money(best.downPayment)} on a ${money(best.homeValue)} house.`}
            />
            <Field
              label="Interest rate"
              suffix="%"
              value={draft.ratePct}
              onChange={set("ratePct")}
              placeholder={String(DEFAULT_RATE_PCT)}
              hint={`The national average for a 30-year loan was ${DEFAULT_RATE_PCT}% in mid-August 2026. Your own rate depends on your credit score.`}
            />
            <Field
              label="Years to pay it off"
              value={draft.years}
              onChange={set("years")}
              placeholder="30"
              hint="Longer means a smaller payment and a bigger house, but far more interest overall."
            />

            <Divider>What you already owe each month</Divider>
            <Field
              label="Credit card payments"
              prefix="$"
              value={draft.cardPayments}
              onChange={set("cardPayments")}
              placeholder="1000"
              hint="What your credit report says the minimums add up to."
            />
            <Field
              label="Car payment"
              prefix="$"
              value={draft.carPayment}
              onChange={set("carPayment")}
              placeholder="2093"
            />
            <Field
              label="Anything else with a monthly payment"
              prefix="$"
              value={draft.otherPayments}
              onChange={set("otherPayments")}
              placeholder="0"
              hint="Student loans, personal loans, child support. Not rent, food or utilities — lenders don't count those."
            />

            <Divider>The lender&apos;s rules and the running costs</Divider>
            <Field
              label="DTI cap"
              suffix="%"
              value={draft.dtiPct}
              onChange={set("dtiPct")}
              placeholder="50"
              hint="How much of your money a lender lets go out the door on debt. 50% is about as far as they stretch."
            />
            <Field
              label="Property tax, per year"
              suffix="%"
              value={draft.propertyTaxPct}
              onChange={set("propertyTaxPct")}
              placeholder={`${result.taxRatePct.toFixed(2)} (from the ZIP)`}
              hint="Leave empty to use the state average. Type a number to pin the real rate once you're looking at an actual house."
            />
            <Field
              label="Home insurance, per year"
              suffix="%"
              value={draft.insurancePct}
              onChange={set("insurancePct")}
              placeholder="0.5"
              hint={`A rough rule of thumb — about ${money((best.homeValue * n(draft.insurancePct)) / 100)} a year on this house. Hurricane and hail country runs much higher.`}
            />
            <Field
              label="Mortgage insurance, per year"
              suffix="%"
              value={draft.pmiPct}
              onChange={set("pmiPct")}
              placeholder="0.55"
              hint={`Charged on the loan, and only while the deposit is under ${PMI_THRESHOLD_PCT}%.`}
            />
            <Field
              label="Association dues, per month"
              prefix="$"
              value={draft.hoaMonthly}
              onChange={set("hoaMonthly")}
              placeholder="0"
              hint="Condos and some neighbourhoods charge these. They come straight off what you can borrow."
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={save}
                disabled={pending}
                className="rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--good)" }}
              >
                {pending ? "Saving…" : "Save these numbers"}
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-border px-4 py-2 text-[14px]"
              >
                Start over
              </button>
              {saved && <span className="text-[13px] text-good">Saved.</span>}
              {error && <span className="text-[13px] text-neg">{error}</span>}
            </div>
            <p className="text-[12px] text-muted">
              The page works without saving — saving just means it&apos;s all still
              here next time you open it.
            </p>
          </div>
        </Card>
      </section>

      {/* ── Houses ───────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Houses at that price</h2>
        {links.length > 0 ? (
          <>
            <p className="mb-3 text-[13px] text-muted">
              These open a real search, already set to your area and capped at{" "}
              {money(best.homeValue)}.
            </p>
            <Card>
              <div className="space-y-2">
                {links.map(({ site, url, note }) => (
                  <a
                    key={site}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-tint"
                  >
                    <div>
                      <div className="font-medium">{site}</div>
                      <div className="text-[12px] text-muted">{note}</div>
                    </div>
                    <span className="text-muted">&gt;</span>
                  </a>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-muted">
                The listings themselves aren&apos;t copied into this app — those
                sites don&apos;t hand their for-sale data out, and a copy would be
                out of date the day it was made. So these send you to the live
                thing instead.
              </p>
            </Card>
          </>
        ) : (
          <Card>
            <p className="text-[14px] text-muted">
              {best.homeValue > 0
                ? "Type a ZIP code or town above and this will fill up with searches at your price."
                : "Once the numbers add up to a house, this will fill up with searches at your price."}
            </p>
          </Card>
        )}
      </section>

      {/* ── The honest bit ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Before you get your hopes up</h2>
        <Card>
          <ul className="space-y-3 text-[14px]">
            <li>
              <strong>This is a sketch, not an approval.</strong> Only a lender
              pulling your credit and reading your tax returns can say a real
              number. This is the same arithmetic they use — it just runs on what
              you typed.
            </li>
            <li>
              <strong>Self-employed money needs a history.</strong> Most lenders
              want two years of tax returns showing the massage income before
              they&apos;ll count a dollar of it. What you expect to earn next year
              isn&apos;t something they can lend against yet.
            </li>
            <li>
              <strong>Your credit score sets the rate.</strong> The rate in the box
              is the national average. A lower score can add a point or more, and
              a point costs you real house — try it and watch the top number drop.
            </li>
            <li>
              <strong>Paying off the card and the car changes everything.</strong>{" "}
              Those two take {money(inputs.cardPayments + inputs.carPayment)} a
              month off the top before a house gets a look in. Set them to zero
              above and see what that&apos;s worth.
            </li>
            <li>
              <strong>The cap is not the target.</strong> Borrowing right up to a
              50% DTI leaves nothing for a broken furnace. Lenders lend to the
              edge; you don&apos;t have to stand on it.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

function shortfallLine(shortfall: number, ceiling: number): string {
  if (ceiling <= 0) return "Put in what you expect to earn and the numbers will start.";
  return `The car and the cards already take ${money(shortfall)} a month more than a lender would allow on this income. There's nothing left for a house until either the income goes up or those come down.`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-tint p-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="text-[17px] font-semibold">{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: "neg";
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${
        strong ? "mt-1 border-t border-border pt-2 font-semibold" : ""
      }`}
    >
      <span className={`text-[14px] ${muted ? "text-muted" : ""}`}>{label}</span>
      <span
        className={`text-[15px] tabular-nums ${tone === "neg" ? "text-neg" : ""} ${
          muted ? "text-muted" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3 text-[13px] font-medium text-muted">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-[14px]">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        {prefix && <span className="text-[15px] text-muted">{prefix}</span>}
        <input
          type="text"
          inputMode={prefix || suffix ? "decimal" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
        />
        {suffix && <span className="text-[15px] text-muted">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}
