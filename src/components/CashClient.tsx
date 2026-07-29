"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui";
import {
  CASH_KINDS,
  cashBalance,
  money,
  type CashEntry,
  type CashKind,
} from "@/lib/data";
import { addCashEntry, deleteCashEntry } from "@/lib/actions";

// Quick-tap amounts so Jamie almost never has to type a number.
const MASSAGE_AMOUNTS = [60, 80, 100, 120];
const OUT_AMOUNTS = [20, 40, 60, 100];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dayLabel(iso: string): string {
  if (iso === todayIso()) return "Today";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function CashClient({
  initialEntries,
  admin,
}: {
  initialEntries: CashEntry[];
  admin: boolean;
}) {
  const [entries, setEntries] = useState<CashEntry[]>(initialEntries);
  const [picked, setPicked] = useState<CashKind | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [status, setStatus] = useState<{
    ok: boolean;
    msg: string;
    undoId?: string;
  } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const balance = cashBalance(entries);
  const shown = showAll ? entries : entries.slice(0, 6);

  function openPicker(kind: CashKind) {
    setPicked(kind);
    setAmountDraft("");
    setStatus(null);
  }

  function save(amount: number) {
    if (!picked || !(amount > 0) || pending) return;
    const kind = picked;
    setPicked(null);
    setStatus(null);
    startTransition(async () => {
      const res = await addCashEntry({ kind, amount });
      if (!res.ok) {
        setStatus({ ok: false, msg: res.error ?? "Couldn't save." });
        return;
      }
      const entry: CashEntry = {
        id: res.id ?? "tmp-" + Date.now(),
        kind,
        amount,
        happenedOn: todayIso(),
      };
      setEntries((e) => [entry, ...e]);
      setStatus({
        ok: true,
        msg: `Got it — ${CASH_KINDS[kind].doneLabel.toLowerCase()}, ${money(amount)}.`,
        undoId: res.id,
      });
    });
  }

  function remove(id: string, label: string) {
    setStatus(null);
    startTransition(async () => {
      const res = await deleteCashEntry(id);
      if (res.ok) {
        setEntries((e) => e.filter((x) => x.id !== id));
        setStatus({ ok: true, msg: `${label} removed.` });
      } else {
        setStatus({ ok: false, msg: res.error ?? "Couldn't remove that." });
      }
    });
  }

  const kindMeta = picked ? CASH_KINDS[picked] : null;
  const chips = picked === "massage" ? MASSAGE_AMOUNTS : OUT_AMOUNTS;

  return (
    <div className="space-y-4">
      {/* The one number that matters: cash in his pocket right now. */}
      <div className="rounded-2xl bg-good-bg p-5 text-center">
        <p className="text-[15px] font-medium text-good">
          💵 Cash in your pocket
        </p>
        <p className="mt-1 text-5xl font-bold text-good">{money(balance)}</p>
      </div>

      {status && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-[15px]"
          style={{
            background: status.ok ? "var(--good-bg)" : "var(--warn-bg)",
            color: status.ok ? "var(--good)" : "var(--warn)",
          }}
        >
          <span>
            {status.ok ? "✓ " : "⚠ "}
            {status.msg}
          </span>
          {status.undoId && (
            <button
              className="ml-3 shrink-0 font-medium underline"
              onClick={() => remove(status.undoId!, "That one")}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Big buttons — tap one every time cash moves. */}
      {!picked && (
        <div className="space-y-3">
          <button
            className="w-full rounded-2xl py-5 text-lg font-semibold text-white active:scale-[0.99]"
            style={{ background: "var(--good)" }}
            onClick={() => openPicker("massage")}
          >
            {CASH_KINDS.massage.emoji} {CASH_KINDS.massage.label}
          </button>
          <div className="grid grid-cols-1 gap-2">
            {(["to_chris", "deposit", "spent"] as CashKind[]).map((k) => (
              <button
                key={k}
                className="w-full rounded-2xl border border-border bg-card py-4 text-[17px] font-medium active:scale-[0.99]"
                onClick={() => openPicker(k)}
              >
                {CASH_KINDS[k].emoji} {CASH_KINDS[k].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount picker — big taps first, typing only if needed. */}
      {picked && kindMeta && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-medium">
              {kindMeta.emoji} {kindMeta.label} — how much?
            </p>
            <button
              aria-label="Cancel"
              className="text-muted"
              onClick={() => setPicked(null)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {chips.map((a) => (
              <button
                key={a}
                className="rounded-xl border border-border bg-tint py-4 text-xl font-semibold active:scale-[0.98]"
                onClick={() => save(a)}
                disabled={pending}
              >
                {money(a)}
              </button>
            ))}
            {kindMeta.direction === -1 && balance > 0 && (
              <button
                className="col-span-2 rounded-xl border border-border bg-tint py-4 text-xl font-semibold active:scale-[0.98]"
                onClick={() => save(balance)}
                disabled={pending}
              >
                All of it ({money(balance)})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted">
                $
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Other amount"
                className="w-full rounded-xl border border-border bg-card py-3 pl-8 pr-3 text-lg outline-none focus:border-[var(--muted)]"
                value={amountDraft}
                onChange={(e) => setAmountDraft(e.target.value)}
              />
            </div>
            <button
              className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-lg font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--good)" }}
              onClick={() => save(Math.round(Number(amountDraft) || 0))}
              disabled={pending || !(Number(amountDraft) > 0)}
            >
              <Check size={18} />
              Save
            </button>
          </div>
        </Card>
      )}

      {/* The story so far — tap "Show everything" to dig in. */}
      {entries.length > 0 && (
        <Card>
          <p className="mb-1 text-[13px] text-muted">What happened lately</p>
          {shown.map((e) => {
            const meta = CASH_KINDS[e.kind];
            const isIn = meta.direction === 1;
            return (
              <div
                key={e.id}
                className="flex items-center justify-between border-t border-border py-3 text-[15px] first:border-t-0"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="text-lg">{meta.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{meta.doneLabel}</span>
                    <span className="block text-xs text-muted">
                      {dayLabel(e.happenedOn)}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span
                    className="font-medium"
                    style={{ color: isIn ? "var(--good)" : "var(--text)" }}
                  >
                    {isIn ? "+" : "−"}
                    {money(e.amount)}
                  </span>
                  {admin && (
                    <button
                      aria-label="Delete entry"
                      className="text-muted"
                      onClick={() => remove(e.id, meta.doneLabel)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {entries.length > 6 && (
            <button
              className="mt-2 w-full rounded-lg border border-border py-2 text-sm text-muted"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? "Show less" : `Show everything (${entries.length})`}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
