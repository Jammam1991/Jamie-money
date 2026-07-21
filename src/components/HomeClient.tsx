"use client";

import { useState, useTransition } from "react";
import {
  CircleCheck,
  ArrowUpRight,
  ArrowDownRight,
  Coffee,
  ShoppingCart,
  Banknote,
  Check,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, Tint } from "@/components/ui";
import { money, moneyCents, type Summary, type Txn } from "@/lib/data";
import { updateSummary } from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const smallInput =
  "w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none";

const txnIcon = {
  coffee: Coffee,
  groceries: ShoppingCart,
  pay: Banknote,
  bill: Banknote,
  other: Banknote,
} as const;

function Row({ txn }: { txn: Txn }) {
  const Icon = txnIcon[txn.kind];
  const isIn = txn.amount > 0;
  return (
    <div className="flex items-center justify-between border-t border-border py-2.5 text-[15px] first:border-t-0">
      <span className="flex items-center gap-2.5">
        <Icon size={18} className="text-muted" />
        {txn.name}
      </span>
      <span style={{ color: isIn ? "var(--good)" : "var(--text)" }}>
        {moneyCents(txn.amount)}
      </span>
    </div>
  );
}

export default function HomeClient({
  initial,
  admin,
}: {
  initial: Summary;
  admin: boolean;
}) {
  const [data, setData] = useState<Summary>(initial);
  const [editing, setEditing] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (editing) {
    return (
      <SummaryForm
        initial={data}
        onCancel={() => setEditing(false)}
        onSaved={(next) => {
          setData(next);
          setEditing(false);
        }}
      />
    );
  }

  const up = data.netWorthChange >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-medium">Hi Jamie</span>
        <span className="text-[13px] text-muted">{today}</span>
      </div>

      {admin && (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
          onClick={() => setEditing(true)}
        >
          <Pencil size={15} />
          Edit these numbers
        </button>
      )}

      <div className="rounded-2xl bg-good-bg p-4">
        <div className="flex items-center gap-2 font-medium text-good">
          <CircleCheck size={20} />
          {data.statusLabel}
        </div>
        {data.statusNote && (
          <p className="mt-1 text-sm text-good">{data.statusNote}</p>
        )}
      </div>

      <Card>
        <p className="text-[13px] text-muted">Your net worth</p>
        <p className="text-3xl font-medium">{money(data.netWorth)}</p>
        <p
          className="mt-1 flex items-center gap-1 text-[13px]"
          style={{ color: up ? "var(--good)" : "var(--text)" }}
        >
          {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
          {up ? "up" : "down"} {money(Math.abs(data.netWorthChange))} this month
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tint>
          <p className="text-xs text-muted">Money in</p>
          <p className="text-lg font-medium text-good">{money(data.moneyIn)}</p>
        </Tint>
        <Tint>
          <p className="text-xs text-muted">Money out</p>
          <p className="text-lg font-medium">{money(data.moneyOut)}</p>
        </Tint>
      </div>

      {data.recent.length > 0 && (
        <Card>
          <p className="mb-1 text-[13px] text-muted">Recent</p>
          {data.recent.map((t) => (
            <Row key={t.id} txn={t} />
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Edit form ─────────────────────────────────────────────────────────────────
type RecentDraft = { id: string; name: string; amount: string; isIn: boolean };

function SummaryForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Summary;
  onCancel: () => void;
  onSaved: (next: Summary) => void;
}) {
  const [statusLabel, setStatusLabel] = useState(initial.statusLabel);
  const [statusNote, setStatusNote] = useState(initial.statusNote);
  const [netWorth, setNetWorth] = useState(String(initial.netWorth));
  const [change, setChange] = useState(String(initial.netWorthChange));
  const [moneyIn, setMoneyIn] = useState(String(initial.moneyIn));
  const [moneyOut, setMoneyOut] = useState(String(initial.moneyOut));
  const [recent, setRecent] = useState<RecentDraft[]>(
    initial.recent.map((t) => ({
      id: t.id,
      name: t.name,
      amount: String(Math.abs(t.amount)),
      isIn: t.amount > 0,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextId = () => "r" + (recent.length + 1) + "-" + recent.reduce((a, r) => a + r.id.length, 0);

  function updateRow(i: number, patch: Partial<RecentDraft>) {
    setRecent(recent.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function save() {
    const cleanRecent: Txn[] = recent
      .filter((r) => r.name.trim())
      .map((r) => {
        const amt = Math.abs(Number(r.amount) || 0);
        return {
          id: r.id,
          name: r.name.trim(),
          kind: (r.isIn ? "pay" : "other") as Txn["kind"],
          amount: r.isIn ? amt : -amt,
        };
      });

    const next: Summary = {
      statusLabel: statusLabel.trim() || "You're doing okay",
      statusNote: statusNote.trim(),
      netWorth: Math.round(Number(netWorth) || 0),
      netWorthChange: Math.round(Number(change) || 0),
      moneyIn: Math.round(Number(moneyIn) || 0),
      moneyOut: Math.round(Number(moneyOut) || 0),
      recent: cleanRecent,
    };

    setError(null);
    startTransition(async () => {
      const res = await updateSummary({
        statusLabel: next.statusLabel,
        statusNote: next.statusNote,
        netWorth: next.netWorth,
        netWorthChange: next.netWorthChange,
        moneyIn: next.moneyIn,
        moneyOut: next.moneyOut,
        recent: next.recent,
      });
      if (res.ok) onSaved(next);
      else setError(res.error ?? "Couldn't save.");
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <label className="text-[13px] text-muted">How Jamie&apos;s doing (headline)</label>
        <input
          className={inputClass + " mt-1"}
          placeholder="e.g. You're doing okay"
          value={statusLabel}
          onChange={(e) => setStatusLabel(e.target.value)}
        />
        <label className="mt-3 block text-[13px] text-muted">A short note</label>
        <input
          className={inputClass + " mt-1"}
          placeholder="e.g. You spent a little less this week."
          value={statusNote}
          onChange={(e) => setStatusNote(e.target.value)}
        />
      </Card>

      <Card>
        <label className="text-[13px] text-muted">Net worth ($)</label>
        <input
          type="number"
          inputMode="numeric"
          className={inputClass + " mt-1"}
          value={netWorth}
          onChange={(e) => setNetWorth(e.target.value)}
        />
        <label className="mt-3 block text-[13px] text-muted">
          Change this month ($ — use a minus sign if it went down)
        </label>
        <input
          type="number"
          inputMode="numeric"
          className={inputClass + " mt-1"}
          value={change}
          onChange={(e) => setChange(e.target.value)}
        />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <label className="text-[13px] text-muted">Money in ($)</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass + " mt-1"}
            value={moneyIn}
            onChange={(e) => setMoneyIn(e.target.value)}
          />
        </Card>
        <Card>
          <label className="text-[13px] text-muted">Money out ($)</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass + " mt-1"}
            value={moneyOut}
            onChange={(e) => setMoneyOut(e.target.value)}
          />
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-[13px] text-muted">Recent activity</p>
        <div className="space-y-2">
          {recent.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={smallInput + " flex-1"}
                placeholder="Name (e.g. Groceries)"
                value={r.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
              />
              <input
                type="number"
                inputMode="decimal"
                className={smallInput + " w-24"}
                placeholder="Amount"
                value={r.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
              />
              <button
                type="button"
                className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium"
                style={{ color: r.isIn ? "var(--good)" : "var(--text)" }}
                onClick={() => updateRow(i, { isIn: !r.isIn })}
              >
                {r.isIn ? "In" : "Out"}
              </button>
              <button
                aria-label="Remove"
                className="text-muted"
                onClick={() => setRecent(recent.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
          onClick={() =>
            setRecent([...recent, { id: nextId(), name: "", amount: "", isIn: false }])
          }
        >
          <Plus size={16} />
          Add activity
        </button>
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
