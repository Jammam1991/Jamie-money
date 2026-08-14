"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { setHouseholdIncome } from "@/lib/actions";
import type { HouseholdIncome } from "@/lib/store";

// ── A fallback, not the source ───────────────────────────────────────────────
// Chris's pay and the rental's rent are read from Money App's own ledger, and
// what it sends always wins over what's typed here. These boxes only stand in
// where Money App has nothing to send — it's unreachable, or a month genuinely
// has no paycheck on record.
//
// They're kept because they're what the page ran on before that feed existed,
// and because a Big Picture that goes blank when another app is down is worse
// than one running a month behind.
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
      <h2 className="mb-1 text-lg font-medium">Household income (backup only)</h2>
      <p className="mb-3 text-[13px] text-muted">
        The Big Picture reads both of these from the Money App&apos;s own ledger —
        your paychecks and the rental&apos;s rent — and what it finds always wins
        over what&apos;s here. These boxes only get used if the Money App
        can&apos;t be reached. Safe to leave empty.
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
