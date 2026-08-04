"use client";

// The debt-to-income calculator from Money App's Credit Report screen. Scratch
// work, so what's typed in stays in this browser (localStorage) rather than the
// database — nothing here is sent anywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney, type ReportAccount } from "@/lib/creditReport";

type CustomDebt = { id: string; name: string; amount: number };

type StoredState = {
  income: string;
  newPayment: string;
  threshold: number;
  excluded: string[];
  custom: CustomDebt[];
};

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-pos",
  warn: "text-warn",
  bad: "text-neg",
  neutral: "text-foreground",
};

const DEFAULT_THRESHOLD = 45;
const THRESHOLD_PRESETS = [36, 43, 45, 50];

const INPUT =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";

function parseNum(s: string): number {
  const v = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(v) ? 0 : v;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `custom-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function ResultTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="text-[10px] text-faint mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

export function DebtToIncomeCalculator({
  reportAccounts,
  storageKey,
}: {
  reportAccounts: ReportAccount[];
  storageKey: string;
}) {
  // Business loans ride on the personal report but aren't personal FICO debt,
  // so default them out of DTI too — the checkbox still lets one back in if a
  // lender is counting a personal guarantee.
  const debtItems = useMemo(
    () =>
      reportAccounts
        .filter((a) => a.open && (a.monthlyPayment ?? 0) > 0)
        .map((a, i) => ({
          key: `${a.name}-${i}`,
          name: a.name,
          amount: a.monthlyPayment ?? 0,
          isBusiness: a.group === "business",
        })),
    [reportAccounts],
  );

  const [state, setState] = useState<StoredState>({
    income: "",
    newPayment: "",
    threshold: DEFAULT_THRESHOLD,
    excluded: [],
    custom: [],
  });
  const { income, newPayment, threshold, custom } = state;
  const excluded = useMemo(() => new Set(state.excluded), [state.excluded]);
  const loadedRef = useRef(false);

  const setIncome = (v: string) => setState((s) => ({ ...s, income: v }));
  const setNewPayment = (v: string) => setState((s) => ({ ...s, newPayment: v }));
  const setThreshold = (v: number) => setState((s) => ({ ...s, threshold: v }));
  const setCustom = (u: CustomDebt[] | ((prev: CustomDebt[]) => CustomDebt[])) =>
    setState((s) => ({ ...s, custom: typeof u === "function" ? u(s.custom) : u }));

  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtAmount, setNewDebtAmount] = useState("");

  // Read the saved calculator after mount (not in a lazy initializer) so the
  // server and first client render agree — no hydration mismatch.
  useEffect(() => {
    let restored: StoredState | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) restored = JSON.parse(raw);
    } catch {
      // corrupt or unavailable storage — fall through to defaults
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store; reading it after mount is the hydration-safe pattern.
    setState(
      restored ?? {
        income: "",
        newPayment: "",
        threshold: DEFAULT_THRESHOLD,
        excluded: debtItems.filter((d) => d.isBusiness).map((d) => d.key),
        custom: [],
      },
    );
    loadedRef.current = true;
    // Only re-run for a different storage key; the report reloading shouldn't
    // wipe an already-loaded, hand-edited exclusion set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // storage full/unavailable — the calculator still works for this session
    }
  }, [storageKey, state]);

  function toggleExcluded(key: string) {
    setState((s) => {
      const next = new Set(s.excluded);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...s, excluded: [...next] };
    });
  }

  function addCustomDebt() {
    const amount = parseNum(newDebtAmount);
    if (!newDebtName.trim() || amount <= 0) return;
    setCustom((prev) => [...prev, { id: nextId(), name: newDebtName.trim(), amount }]);
    setNewDebtName("");
    setNewDebtAmount("");
  }

  function removeCustomDebt(id: string) {
    setCustom((prev) => prev.filter((d) => d.id !== id));
  }

  const includedReportTotal = debtItems
    .filter((d) => !excluded.has(d.key))
    .reduce((s, d) => s + d.amount, 0);
  const customTotal = custom.reduce((s, d) => s + d.amount, 0);
  const baseDebt = includedReportTotal + customTotal;

  const newPaymentNum = parseNum(newPayment);
  const withNewLoan = baseDebt + newPaymentNum;

  const incomeNum = parseNum(income);
  const currentDti = incomeNum > 0 ? (baseDebt / incomeNum) * 100 : null;
  const dtiWithNew = incomeNum > 0 ? (withNewLoan / incomeNum) * 100 : null;

  const maxDebtAtThreshold = incomeNum > 0 ? (incomeNum * threshold) / 100 : null;
  const headroom = maxDebtAtThreshold != null ? maxDebtAtThreshold - baseDebt : null;

  const requiredIncomeForNew = newPaymentNum > 0 ? withNewLoan / (threshold / 100) : null;

  function dtiTone(dti: number | null): Tone {
    if (dti == null) return "neutral";
    if (dti <= threshold - 5) return "good";
    if (dti <= threshold) return "warn";
    return "bad";
  }

  const includedCount = debtItems.length - excluded.size + custom.length;
  const totalCount = debtItems.length + custom.length;

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-1">
        Debt-to-income
      </p>
      <p className="text-[11px] text-faint mb-3 leading-tight">
        Lenders compare monthly debt payments to monthly income — most cap it around 43–45%, some
        go to 50% for strong credit.
      </p>

      {/* Target DTI */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <label className="text-xs font-medium text-muted">Target DTI</label>
        {THRESHOLD_PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setThreshold(t)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
              threshold === t
                ? "bg-accent border-accent text-white"
                : "border-border bg-surface text-muted"
            }`}
          >
            {t}%
          </button>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) =>
              setThreshold(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 0)))
            }
            className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-xs text-faint">% custom</span>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">Monthly income</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 9,500"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            New loan payment you&apos;re considering
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 650"
            value={newPayment}
            onChange={(e) => setNewPayment(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <ResultTile
          label="Monthly debt"
          value={fmtMoney(baseDebt, { decimals: 0 })}
          sub={`${includedCount} of ${totalCount} items included`}
        />
        <ResultTile
          label="Current DTI"
          value={currentDti != null ? fmtPct(currentDti) : "—"}
          sub={currentDti != null ? `vs ${threshold}% target` : "Enter income above"}
          tone={dtiTone(currentDti)}
        />
        <ResultTile
          label="DTI with new loan"
          value={dtiWithNew != null ? fmtPct(dtiWithNew) : "—"}
          sub={
            newPaymentNum > 0
              ? `+${fmtMoney(newPaymentNum, { decimals: 0 })}/mo`
              : "No new payment entered"
          }
          tone={dtiTone(dtiWithNew)}
        />
        {newPaymentNum > 0 ? (
          <ResultTile
            label="Income needed"
            value={fmtMoney(requiredIncomeForNew ?? 0, { decimals: 0 })}
            sub={`/mo to stay at ${threshold}%`}
          />
        ) : (
          <ResultTile
            label="Room for new debt"
            value={headroom != null ? fmtMoney(Math.abs(headroom), { decimals: 0 }) : "—"}
            sub={
              headroom == null
                ? "Enter income above"
                : headroom >= 0
                  ? `more debt fits at ${threshold}%`
                  : `over ${threshold}% already`
            }
            tone={headroom == null ? "neutral" : headroom >= 0 ? "good" : "bad"}
          />
        )}
      </div>

      {/* Itemized debts — toggle report items out, remove custom ones entirely */}
      <div className="space-y-1 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-1.5">
          Included in this calculation
        </p>
        {debtItems.length === 0 && custom.length === 0 && (
          <p className="text-xs text-faint py-1">No monthly debts yet — add one below.</p>
        )}
        {debtItems.map((d) => (
          <label
            key={d.key}
            className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${
              excluded.has(d.key) ? "opacity-40" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={!excluded.has(d.key)}
              onChange={() => toggleExcluded(d.key)}
              className="w-3.5 h-3.5 accent-[var(--accent)] shrink-0"
            />
            <span className="flex-1 text-foreground truncate">{d.name}</span>
            {d.isBusiness && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent shrink-0">
                BUSINESS
              </span>
            )}
            <span className="text-muted tabular-nums shrink-0">
              {fmtMoney(d.amount, { decimals: 0 })}/mo
            </span>
          </label>
        ))}
        {custom.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-accent/20 shrink-0" />
            <span className="flex-1 text-foreground truncate">{d.name}</span>
            <span className="text-muted tabular-nums shrink-0">
              {fmtMoney(d.amount, { decimals: 0 })}/mo
            </span>
            <button
              type="button"
              onClick={() => removeCustomDebt(d.id)}
              className="text-faint shrink-0"
              aria-label={`Remove ${d.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add a debt not on the credit report */}
      <div className="flex items-end gap-2 pt-3 border-t border-border">
        <div className="flex-1">
          <label className="text-[10px] text-faint block mb-1">Debt not on the report</label>
          <input
            type="text"
            placeholder="e.g. Child support"
            value={newDebtName}
            onChange={(e) => setNewDebtName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomDebt()}
            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="w-28 shrink-0">
          <label className="text-[10px] text-faint block mb-1">$/mo</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={newDebtAmount}
            onChange={(e) => setNewDebtAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomDebt()}
            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          type="button"
          onClick={addCustomDebt}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}
