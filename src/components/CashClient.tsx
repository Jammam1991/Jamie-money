"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, Trash2, X } from "lucide-react";
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
const MASSAGE_AMOUNTS = [100, 150, 200, 250, 300];
const OUT_AMOUNTS = [20, 40, 60, 100];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Tiny store for the Sunday nudge so the banner can live-update when it's
// dismissed (localStorage alone doesn't notify the same tab).
let nudgeListeners: (() => void)[] = [];
function subscribeNudge(cb: () => void) {
  nudgeListeners.push(cb);
  return () => {
    nudgeListeners = nudgeListeners.filter((l) => l !== cb);
  };
}
function sundayNudgeVisible(): boolean {
  return (
    new Date().getDay() === 0 &&
    !localStorage.getItem(`jm-sunday-nudge-${todayIso()}`)
  );
}
function dismissSundayNudge() {
  localStorage.setItem(`jm-sunday-nudge-${todayIso()}`, "seen");
  nudgeListeners.forEach((l) => l());
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
  nextMonthName,
  nextMonthTotal,
}: {
  initialEntries: CashEntry[];
  admin: boolean;
  nextMonthName: string;
  nextMonthTotal: number;
}) {
  const [entries, setEntries] = useState<CashEntry[]>(initialEntries);
  const [picked, setPicked] = useState<CashKind | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [dateDraft, setDateDraft] = useState(todayIso());
  const [status, setStatus] = useState<{
    ok: boolean;
    msg: string;
    undoId?: string;
  } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  // Sunday pop-up: the week ends today, so remind Jamie to get everything
  // logged. Decided on the phone's own clock (the server may be in another
  // timezone — the server snapshot is always false), and once dismissed it
  // stays hidden for the rest of the day.
  const showSundayNudge = useSyncExternalStore(
    subscribeNudge,
    sundayNudgeVisible,
    () => false
  );

  const balance = cashBalance(entries);
  const shown = showAll ? entries : entries.slice(0, 6);

  function openPicker(kind: CashKind) {
    setPicked(kind);
    setAmountDraft("");
    setDateDraft(todayIso());
    setStatus(null);
  }

  function save(amount: number) {
    if (!picked || !(amount > 0) || pending) return;
    const kind = picked;
    const happenedOn = dateDraft || todayIso();
    setPicked(null);
    setStatus(null);
    startTransition(async () => {
      const res = await addCashEntry({ kind, amount, happenedOn });
      if (!res.ok) {
        setStatus({ ok: false, msg: res.error ?? "Couldn't save." });
        return;
      }
      const entry: CashEntry = {
        id: res.id ?? "tmp-" + Date.now(),
        kind,
        amount,
        happenedOn,
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
      {/* Sunday pop-up: last call to log the week. */}
      {showSundayNudge && (
        <div
          className="flex items-start justify-between gap-3 rounded-2xl p-4"
          style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
        >
          <p className="text-[15px]">
            ⏰ <span className="font-semibold">It&apos;s Sunday!</span> The week
            ends today — make sure every massage and every bit of cash from
            this week is logged below.
          </p>
          <button
            aria-label="Dismiss reminder"
            className="shrink-0"
            onClick={dismissSundayNudge}
          >
            <X size={18} />
          </button>
        </div>
      )}

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
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] text-muted">
              When? {dateDraft === todayIso() ? "(today)" : ""}
            </span>
            <input
              type="date"
              className="rounded-xl border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]"
              value={dateDraft}
              max={todayIso()}
              onChange={(e) => setDateDraft(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {chips.map((a, i) => (
              <button
                key={a}
                className={
                  "rounded-xl border border-border bg-tint py-4 text-xl font-semibold active:scale-[0.98]" +
                  (i === chips.length - 1 && chips.length % 2 === 1
                    ? " col-span-2"
                    : "")
                }
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

      {/* Saving goal: what next month's bills will cost. Tap to see the bills. */}
      {nextMonthTotal > 0 && (
        <Link
          href="/bills"
          className="flex items-center justify-between rounded-2xl p-4"
          style={
            balance >= nextMonthTotal
              ? { background: "var(--good-bg)", color: "var(--good)" }
              : { background: "var(--warn-bg)", color: "var(--warn)" }
          }
        >
          <span className="text-[15px]">
            {balance >= nextMonthTotal ? (
              <>🎉 You have enough for {nextMonthName}&apos;s bills!</>
            ) : (
              <>
                🗓️{" "}
                <span className="font-semibold">
                  {money(nextMonthTotal - balance)}
                </span>{" "}
                more needed for {nextMonthName} bills
              </>
            )}
          </span>
          <ChevronRight size={18} className="shrink-0" />
        </Link>
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
