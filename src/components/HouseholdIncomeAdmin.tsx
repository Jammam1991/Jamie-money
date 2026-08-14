"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { setHouseholdIncome } from "@/lib/actions";
import type { HouseholdIncome } from "@/lib/store";

// ── The two incomes The Big Picture can't work out for itself ────────────────
// Jamie's pay comes from the gym dashboard, his massage work from the weekly
// figure on the Bills page, and the gym's revenue from Money App. Chris's own
// pay and the rent the rental brings in live nowhere this app can read, so they
// get typed here.
//
// Blank is not zero. An empty box means "not set", and the page says the income
// is incomplete rather than showing a shortfall built on a missing wage.

function toNumber(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function HouseholdIncomeAdmin({
  initial,
}: {
  initial: HouseholdIncome;
}) {
  const [chris, setChris] = useState(initial.chris?.toString() ?? "");
  const [rental, setRental] = useState(initial.rental?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setHouseholdIncome({
        chris: toNumber(chris),
        rental: toNumber(rental),
      });
      if (result.ok) setSaved(true);
      else setError(result.error ?? "Couldn't save.");
    });
  };

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium">Household income</h2>
      <p className="mb-3 text-[13px] text-muted">
        Used by The Big Picture to work out what comes in each month. Jamie&apos;s
        income and the gym&apos;s revenue are already read automatically — these
        two aren&apos;t anywhere this app can reach.
      </p>

      <Card>
        <div className="space-y-4">
          <Field
            label="Chris's take-home, per month"
            value={chris}
            onChange={setChris}
            placeholder="e.g. 8000"
          />
          <Field
            label="Rent from the rental, per month"
            value={rental}
            onChange={setRental}
            placeholder="e.g. 3600"
            hint="Before its mortgage — that's already counted with the other loans."
          />

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--good)" }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-[13px] text-good">Saved.</span>}
            {error && <span className="text-[13px] text-neg">{error}</span>}
          </div>

          <p className="text-[12px] text-muted">
            Leave a box empty if you don&apos;t want it counted — empty means
            &quot;not known&quot;, and the page says so rather than treating it as
            zero.
          </p>
        </div>
      </Card>
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
  placeholder: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[14px]">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[15px] text-muted">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
        />
      </div>
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}
