"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { Card, Tint } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import { setCarInfo, setCarHistory } from "@/lib/actions";
import { carLoanParts, duration, monthsToClear } from "@/lib/payoff";
import {
  DEFAULT_CAR_INFO,
  carCostSummary,
  currentCarValue,
  depreciationEstimate,
  primaryCarDebt,
  type CarHistoryEntry,
  type CarInfo,
} from "@/lib/carInfo";

// Every box holds text, not a number, same reason as Home Buying — a
// half-typed "2." shouldn't get snapped back to 2 under your fingers.
type Draft = {
  purchasePrice: string;
  purchaseDate: string;
  mileage: string;
  mileageUpdatedAt: string;
  insuranceProvider: string;
  insuranceMonthly: string;
  insurancePolicyNumber: string;
  estimatedValueOverride: string;
  warrantyExpires: string;
  warrantyMileageLimit: string;
  warrantyCoverage: string;
  maintenanceToDate: string;
};

function toDraft(i: CarInfo): Draft {
  return {
    purchasePrice: String(i.purchasePrice),
    purchaseDate: i.purchaseDate ?? "",
    mileage: i.mileage === null ? "" : String(i.mileage),
    mileageUpdatedAt: i.mileageUpdatedAt ?? "",
    insuranceProvider: i.insuranceProvider,
    insuranceMonthly: String(i.insuranceMonthly),
    insurancePolicyNumber: i.insurancePolicyNumber,
    estimatedValueOverride: i.estimatedValueOverride === null ? "" : String(i.estimatedValueOverride),
    warrantyExpires: i.warrantyExpires ?? "",
    warrantyMileageLimit: i.warrantyMileageLimit === null ? "" : String(i.warrantyMileageLimit),
    warrantyCoverage: i.warrantyCoverage,
    maintenanceToDate: String(i.maintenanceToDate),
  };
}

function n(v: string, fallback = 0): number {
  const parsed = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function nOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const parsed = Number(t.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function dateOrNull(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

function toInfo(d: Draft): CarInfo {
  return {
    purchasePrice: n(d.purchasePrice, DEFAULT_CAR_INFO.purchasePrice),
    purchaseDate: dateOrNull(d.purchaseDate),
    mileage: nOrNull(d.mileage),
    mileageUpdatedAt: dateOrNull(d.mileageUpdatedAt),
    insuranceProvider: d.insuranceProvider,
    insuranceMonthly: n(d.insuranceMonthly),
    insurancePolicyNumber: d.insurancePolicyNumber,
    estimatedValueOverride: nOrNull(d.estimatedValueOverride),
    warrantyExpires: dateOrNull(d.warrantyExpires),
    warrantyMileageLimit: nOrNull(d.warrantyMileageLimit),
    warrantyCoverage: d.warrantyCoverage,
    maintenanceToDate: n(d.maintenanceToDate),
  };
}

// The history list edits as strings too, one draft row per past car.
type HistoryDraft = {
  id: string;
  name: string;
  purchaseDate: string;
  soldDate: string;
  purchasePrice: string;
  tradeInValue: string;
  negativeEquity: string;
  notes: string;
};

function toHistoryDraft(e: CarHistoryEntry): HistoryDraft {
  return {
    id: e.id,
    name: e.name,
    purchaseDate: e.purchaseDate ?? "",
    soldDate: e.soldDate ?? "",
    purchasePrice: e.purchasePrice === null ? "" : String(e.purchasePrice),
    tradeInValue: e.tradeInValue === null ? "" : String(e.tradeInValue),
    negativeEquity: e.negativeEquity === null ? "" : String(e.negativeEquity),
    notes: e.notes,
  };
}

function toHistoryEntry(d: HistoryDraft): CarHistoryEntry {
  return {
    id: d.id,
    name: d.name,
    purchaseDate: dateOrNull(d.purchaseDate),
    soldDate: dateOrNull(d.soldDate),
    purchasePrice: nOrNull(d.purchasePrice),
    tradeInValue: nOrNull(d.tradeInValue),
    negativeEquity: nOrNull(d.negativeEquity),
    notes: d.notes,
  };
}

let nextTempId = 0;
function tempId(): string {
  nextTempId += 1;
  return `new-${nextTempId}`;
}

export default function CarsClient({
  debts,
  initialInfo,
  initialHistory,
  today,
}: {
  debts: Debt[];
  initialInfo: CarInfo;
  initialHistory: CarHistoryEntry[];
  today: string;
}) {
  const carDebt = useMemo(() => primaryCarDebt(debts), [debts]);
  const parts = carDebt ? carLoanParts(carDebt) : null;
  const monthsLeft = carDebt
    ? monthsToClear(carDebt.balance, carDebt.apr, carDebt.minPayment)
    : null;

  const [draft, setDraft] = useState<Draft>(() => toDraft(initialInfo));
  const [infoSaved, setInfoSaved] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoPending, startInfoTransition] = useTransition();

  const [history, setHistory] = useState<HistoryDraft[]>(() =>
    initialHistory.map(toHistoryDraft),
  );
  const [historySaved, setHistorySaved] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPending, startHistoryTransition] = useTransition();

  const set = (key: keyof Draft) => (value: string) => {
    setInfoSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const info = useMemo(() => toInfo(draft), [draft]);
  const curveEstimate = useMemo(
    () => depreciationEstimate(info.purchasePrice, info.purchaseDate, today),
    [info.purchasePrice, info.purchaseDate, today],
  );
  const value = currentCarValue(info, today);
  const costs = useMemo(
    () => carCostSummary(info, carDebt?.minPayment ?? 0, today),
    [info, carDebt?.minPayment, today],
  );

  const saveInfo = () => {
    setInfoSaved(false);
    setInfoError(null);
    startInfoTransition(async () => {
      const res = await setCarInfo(info);
      if (res.ok) setInfoSaved(true);
      else setInfoError(res.error ?? "Couldn't save.");
    });
  };

  const saveHistory = () => {
    setHistorySaved(false);
    setHistoryError(null);
    startHistoryTransition(async () => {
      const res = await setCarHistory(history.map(toHistoryEntry));
      if (res.ok) setHistorySaved(true);
      else setHistoryError(res.error ?? "Couldn't save.");
    });
  };

  const setHistoryField =
    (id: string, key: keyof HistoryDraft) => (v: string) => {
      setHistorySaved(false);
      setHistory((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
    };

  const addHistoryRow = () => {
    setHistorySaved(false);
    setHistory((rows) => [
      ...rows,
      toHistoryDraft({
        id: tempId(),
        name: "",
        purchaseDate: null,
        soldDate: null,
        purchasePrice: null,
        tradeInValue: null,
        negativeEquity: null,
        notes: "",
      }),
    ]);
  };

  const removeHistoryRow = (id: string) => {
    setHistorySaved(false);
    setHistory((rows) => rows.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* ── The car, at a glance ─────────────────────────────────────────────── */}
      <Card>
        <div className="text-[13px] text-muted">
          {carDebt ? carDebt.name : "No car loan on file yet"}
        </div>
        <div className="mt-1 text-4xl font-bold" style={{ color: "var(--good)" }}>
          {money(value)}
        </div>
        <div className="mt-1 text-[13px] text-muted">
          {info.estimatedValueOverride !== null
            ? "your own estimate"
            : info.purchaseDate
              ? "estimated from the depreciation curve below"
              : "= purchase price — add a purchase date for a real estimate"}
        </div>
        {carDebt && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Loan balance" value={money(carDebt.balance)} />
            <Stat label="APR" value={`${carDebt.apr}%`} />
            <Stat label="Payment, per month" value={money(carDebt.minPayment)} />
            <Stat
              label="Months remaining"
              value={monthsLeft === null ? "—" : duration(monthsLeft)}
            />
          </div>
        )}
      </Card>

      {/* ── What's inside the loan ───────────────────────────────────────────── */}
      {carDebt && (
        <section>
          <h2 className="mb-1 text-lg font-medium">Loan details</h2>
          <p className="mb-3 text-[13px] text-muted">
            Pulled straight from the debt list — this page never stores its own
            copy of the loan.
          </p>
          <Card>
            <Tint>
              <Row label="Balance" value={money(carDebt.balance)} />
              <Row label="APR" value={`${carDebt.apr}%`} />
              <Row label="Monthly payment" value={money(carDebt.minPayment)} />
              <Row
                label="Months remaining"
                value={monthsLeft === null ? "never, at this payment" : duration(monthsLeft)}
              />
            </Tint>

            {parts && (
              <div className="mt-3 rounded-xl bg-tint p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  What&apos;s inside this loan
                </p>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-card">
                  {parts.map((p) => (
                    <div
                      key={p.key}
                      style={{
                        width: `${(p.balance / carDebt.balance) * 100}%`,
                        background: p.key === "taycan" ? "var(--good)" : "var(--warn)",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 space-y-2.5">
                  {parts.map((p) => (
                    <div key={p.key} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.key === "taycan" ? "var(--good)" : "var(--warn)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">
                          {p.emoji} {p.label}
                        </span>
                        <span className="block text-[11px] text-muted">{p.note}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-semibold leading-tight">
                          {money(p.balance)}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {money(p.monthly)}/mo
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* ── Mileage ──────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Mileage</h2>
        <Card>
          <div className="space-y-4">
            <Field
              label="Current odometer reading"
              suffix="mi"
              value={draft.mileage}
              onChange={set("mileage")}
              placeholder="32000"
            />
            <DateField
              label="As of"
              value={draft.mileageUpdatedAt}
              onChange={set("mileageUpdatedAt")}
            />
          </div>
        </Card>
      </section>

      {/* ── Insurance ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Insurance</h2>
        <Card>
          <div className="space-y-4">
            <Field
              label="Provider"
              value={draft.insuranceProvider}
              onChange={set("insuranceProvider")}
              placeholder="e.g. Geico"
            />
            <Field
              label="Monthly cost"
              prefix="$"
              value={draft.insuranceMonthly}
              onChange={set("insuranceMonthly")}
              placeholder="140"
            />
            <Field
              label="Policy number"
              value={draft.insurancePolicyNumber}
              onChange={set("insurancePolicyNumber")}
              placeholder=""
            />
          </div>
        </Card>
      </section>

      {/* ── Value & depreciation ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Value &amp; depreciation</h2>
        <p className="mb-3 text-[13px] text-muted">
          The curve assumes 20% off in the first year and 15% a year after
          that — a rule of thumb, not an appraisal. Type a real number below
          once you have one (a trade-in quote, an appraisal) and it takes
          over.
        </p>
        <Card>
          <div className="space-y-4">
            <Field
              label="What it cost"
              prefix="$"
              value={draft.purchasePrice}
              onChange={set("purchasePrice")}
              placeholder="60000"
            />
            <DateField
              label="Purchase date"
              value={draft.purchaseDate}
              onChange={set("purchaseDate")}
            />
            <Field
              label="Current estimated value"
              prefix="$"
              value={draft.estimatedValueOverride}
              onChange={set("estimatedValueOverride")}
              placeholder={String(Math.round(curveEstimate))}
              hint={
                info.purchaseDate
                  ? `The curve puts it at ${money(curveEstimate)} today. Leave blank to use that.`
                  : "Add a purchase date above for the curve to work from, or type a number here."
              }
            />
          </div>
        </Card>
      </section>

      {/* ── Warranty ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Warranty</h2>
        <Card>
          <div className="space-y-4">
            <DateField
              label="Expires"
              value={draft.warrantyExpires}
              onChange={set("warrantyExpires")}
            />
            <Field
              label="Mileage limit"
              suffix="mi"
              value={draft.warrantyMileageLimit}
              onChange={set("warrantyMileageLimit")}
              placeholder="50000"
            />
            <label className="block">
              <span className="text-[14px]">What&apos;s covered</span>
              <textarea
                value={draft.warrantyCoverage}
                onChange={(e) => set("warrantyCoverage")(e.target.value)}
                placeholder="Powertrain, battery, roadside assistance…"
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
              />
            </label>
          </div>
        </Card>
      </section>

      {/* ── Save bar for everything above ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={saveInfo}
          disabled={infoPending}
          className="rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--good)" }}
        >
          {infoPending ? "Saving…" : "Save mileage, insurance, value & warranty"}
        </button>
        {infoSaved && <span className="text-[13px] text-good">Saved.</span>}
        {infoError && <span className="text-[13px]">{infoError}</span>}
      </div>

      {/* ── Car history ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Car history</h2>
        <p className="mb-3 text-[13px] text-muted">
          The app has no record of what came before the Taycan — only that
          {parts ? ` ${money(parts.find((p) => p.key === "rolled")?.balance ?? 0)} of the current loan is negative equity rolled in from earlier cars` : " negative equity may be rolled into a current loan"}.
          Add the cars themselves here.
        </p>
        <div className="space-y-3">
          {history.length === 0 && (
            <Card>
              <p className="text-[14px] text-muted">
                No past cars added yet.
              </p>
            </Card>
          )}
          {history.map((row) => (
            <Card key={row.id}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Field
                      label="Car"
                      value={row.name}
                      onChange={setHistoryField(row.id, "name")}
                      placeholder="e.g. 2021 Porsche Macan"
                    />
                  </div>
                  <button
                    onClick={() => removeHistoryRow(row.id)}
                    className="mt-6 rounded-lg border border-border px-3 py-2 text-[13px] text-muted hover:bg-tint"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DateField
                    label="Purchased"
                    value={row.purchaseDate}
                    onChange={setHistoryField(row.id, "purchaseDate")}
                  />
                  <DateField
                    label="Sold / traded"
                    value={row.soldDate}
                    onChange={setHistoryField(row.id, "soldDate")}
                  />
                  <Field
                    label="Paid for it"
                    prefix="$"
                    value={row.purchasePrice}
                    onChange={setHistoryField(row.id, "purchasePrice")}
                  />
                  <Field
                    label="Worth at trade-in"
                    prefix="$"
                    value={row.tradeInValue}
                    onChange={setHistoryField(row.id, "tradeInValue")}
                  />
                </div>
                <Field
                  label="Negative equity carried forward"
                  prefix="$"
                  value={row.negativeEquity}
                  onChange={setHistoryField(row.id, "negativeEquity")}
                  hint="What was still owed on it, rolled into the next car's loan."
                />
                <label className="block">
                  <span className="text-[14px]">Notes</span>
                  <textarea
                    value={row.notes}
                    onChange={(e) => setHistoryField(row.id, "notes")(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
                  />
                </label>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={addHistoryRow}
            className="rounded-lg border border-border px-4 py-2 text-[14px]"
          >
            Add a car
          </button>
          <button
            onClick={saveHistory}
            disabled={historyPending}
            className="rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--good)" }}
          >
            {historyPending ? "Saving…" : "Save car history"}
          </button>
          {historySaved && <span className="text-[13px] text-good">Saved.</span>}
          {historyError && <span className="text-[13px]">{historyError}</span>}
        </div>
      </section>

      {/* ── Cost summary ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Cost of ownership</h2>
        <p className="mb-3 text-[13px] text-muted">
          {info.purchaseDate
            ? `Loan payments and insurance, counted from the purchase date over ${duration(costs.monthsOwned)}. Maintenance is whatever total you've typed in above — there's nothing to add it up from automatically.`
            : "Add a purchase date above and this fills in — loan payments and insurance, counted from the day you owned it."}
        </p>
        <Card>
          <Tint>
            <Row label="Loan payments to date" value={money(costs.loanPaidToDate)} />
            <Row label="Insurance to date" value={money(costs.insurancePaidToDate)} />
            <Row label="Maintenance to date" value={money(costs.maintenanceToDate)} />
            <Row label="Total cost of ownership" value={money(costs.total)} strong />
          </Tint>
          <label className="mt-3 block">
            <span className="text-[14px]">Maintenance total, to date</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[15px] text-muted">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={draft.maintenanceToDate}
                onChange={(e) => set("maintenanceToDate")(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
              />
            </div>
            <span className="mt-1 block text-[12px] text-muted">
              Not tracked item by item — just a running total. Saves with the
              button above.
            </span>
          </label>
        </Card>
      </section>
    </div>
  );
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
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${
        strong ? "mt-1 border-t border-border pt-2 font-semibold" : ""
      }`}
    >
      <span className="text-[14px]">{label}</span>
      <span className="text-[15px] tabular-nums">{value}</span>
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

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <label className="block" htmlFor={id}>
      <span className="text-[14px]">{label}</span>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
      />
    </label>
  );
}
