"use client";

// The credit accounts, copied from Money App's screen: pick a report date at
// the top and every balance below rewinds to what it was then. Tap an account
// to open its details and its month-by-month payment squares.

import { useMemo, useState } from "react";
import {
  DEBT_TYPE_COLOR,
  DEBT_TYPE_LABEL,
  fmtLocalDate,
  fmtMoney,
} from "@/lib/creditReport";
import type { CreditAccount, DebtSnapshotRow, FicoScoreEntry } from "@/lib/store";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonthShort(iso: string) {
  const [, m] = iso.split("-");
  return MONTH_SHORT[parseInt(m ?? "1") - 1] ?? "";
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

// ── Payment history squares ─────────────────────────────────────────────────
function PaymentDots({ rows }: { rows: DebtSnapshotRow[] }) {
  if (rows.length === 0) return <span className="text-xs text-faint">No history</span>;

  // One square per month — if a month has more than one row, the latest wins.
  const byMonth: Record<string, DebtSnapshotRow> = {};
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const cur = byMonth[key];
    if (!cur || r.date > cur.date) byMonth[key] = r;
  }
  const months = Object.values(byMonth).sort((a, b) => a.date.localeCompare(b.date));
  const recent = months.slice(-24); // max 24 months

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {recent.map((r) => (
        <div key={r.date} className="flex flex-col items-center gap-0.5">
          <div
            title={`${fmtLocalDate(r.date)}: ${r.missedPayment ? "Late / missed" : "Paid on time"}`}
            className={`w-4 h-4 rounded-sm ${r.missedPayment ? "bg-rose-400" : "bg-emerald-400"}`}
          />
          <span className="text-[8px] text-faint leading-none">{fmtMonthShort(r.date)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Single expandable account row ───────────────────────────────────────────
function AccountRow({
  account,
  displayBalance,
  history,
}: {
  account: CreditAccount;
  displayBalance: number;
  history: DebtSnapshotRow[];
}) {
  const [open, setOpen] = useState(false);

  const latestHist = [...history].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const paymentStatus = latestHist
    ? latestHist.missedPayment
      ? "Late / missed"
      : "Paid / on time"
    : "—";
  const statusColor = latestHist
    ? latestHist.missedPayment
      ? "text-neg"
      : "text-pos"
    : "text-faint";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DEBT_TYPE_COLOR[account.type]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{account.name}</p>
          <p className="text-[11px] text-muted">
            {DEBT_TYPE_LABEL[account.type]}
            {account.apr > 0 && ` · ${account.apr}% APR`}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[11px] font-medium ${statusColor} hidden sm:block`}>
            {paymentStatus}
          </span>
          <span className="text-sm font-bold text-foreground tabular-nums">
            {fmtMoney(displayBalance, { decimals: 0 })}
          </span>
          <svg
            className={`w-4 h-4 text-faint transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-surface border-t border-border space-y-4">
          {/* Detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Balance</p>
              <p className="font-bold text-foreground tabular-nums text-sm">
                {fmtMoney(displayBalance, { decimals: 2 })}
              </p>
            </div>
            <div>
              <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Min payment</p>
              <p className="font-bold text-foreground tabular-nums text-sm">
                {account.minPayment > 0
                  ? fmtMoney(account.minPayment, { decimals: 0 }) + "/mo"
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-faint font-medium uppercase tracking-wide mb-0.5">APR</p>
              <p className="font-bold text-foreground text-sm">
                {account.apr > 0 ? `${account.apr}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Status</p>
              <p className={`font-bold text-sm ${statusColor}`}>{paymentStatus}</p>
            </div>
            <div>
              <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Account type</p>
              <p className="font-semibold text-foreground text-sm">
                {DEBT_TYPE_LABEL[account.type]}
              </p>
            </div>
            {account.openedDate && (
              <div>
                <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Opened</p>
                <p className="font-semibold text-foreground text-sm">
                  {fmtLocalDate(account.openedDate, { month: "short", year: "numeric" })}
                </p>
              </div>
            )}
            {account.creditReportDay != null && (
              <div>
                <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Reports on</p>
                <p className="font-semibold text-foreground text-sm">
                  {account.creditReportDay}
                  {ordinal(account.creditReportDay)} of month
                </p>
              </div>
            )}
            {account.notes && (
              <div className="col-span-2">
                <p className="text-faint font-medium uppercase tracking-wide mb-0.5">Notes</p>
                <p className="text-muted text-sm">{account.notes}</p>
              </div>
            )}
          </div>

          {/* Payment history */}
          {history.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-1.5">
                Payment history ({history.length} entries)
              </p>
              <PaymentDots rows={history} />
              <p className="text-[10px] text-faint mt-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400 align-middle mr-1" />
                On time
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-400 align-middle ml-3 mr-1" />
                Late / missed
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function CreditAccountList({
  accounts,
  ficoHistory,
  debtHistory,
}: {
  accounts: CreditAccount[];
  ficoHistory: FicoScoreEntry[];
  debtHistory: DebtSnapshotRow[];
}) {
  // "null" = current (latest) balances.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Snapshots grouped by the Money App account they belong to.
  const histByAccount = useMemo(() => {
    const map: Record<string, DebtSnapshotRow[]> = {};
    for (const r of debtHistory) {
      if (!map[r.moneyappDebtId]) map[r.moneyappDebtId] = [];
      map[r.moneyappDebtId].push(r);
    }
    return map;
  }, [debtHistory]);

  const historyFor = (a: CreditAccount) =>
    a.moneyappDebtId ? (histByAccount[a.moneyappDebtId] ?? []) : [];

  // Report date tabs — newest first.
  const reportDates = useMemo(
    () =>
      [...ficoHistory]
        .sort((a, b) => b.scoredOn.localeCompare(a.scoredOn))
        .map((f) => ({ date: f.scoredOn, score: f.score })),
    [ficoHistory],
  );

  // For a past date, the balance is the newest snapshot on or before it.
  function balanceAt(account: CreditAccount, date: string): number {
    const rows = historyFor(account)
      .filter((r) => r.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return rows[0]?.balance ?? account.balance;
  }

  const sorted = [...accounts].sort((a, b) => b.balance - a.balance);
  const totalBalance = sorted.reduce(
    (s, a) => s + (selectedDate ? balanceAt(a, selectedDate) : a.balance),
    0,
  );

  const selectedScore = selectedDate
    ? (reportDates.find((r) => r.date === selectedDate)?.score ?? null)
    : (reportDates[0]?.score ?? null);

  return (
    <div className="space-y-3">
      {/* Report date tabs */}
      {reportDates.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-2.5">
            Report history
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            <button
              onClick={() => setSelectedDate(null)}
              className={`shrink-0 flex flex-col items-center px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                selectedDate === null
                  ? "bg-accent border-accent text-white"
                  : "bg-card border-border text-muted"
              }`}
            >
              <span>Current</span>
              {selectedDate === null && selectedScore != null && (
                <span className="text-[10px] font-normal mt-0.5 opacity-80">
                  FICO {selectedScore}
                </span>
              )}
            </button>

            {reportDates.map((rd) => (
              <button
                key={rd.date}
                onClick={() => setSelectedDate(rd.date)}
                className={`shrink-0 flex flex-col items-center px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  selectedDate === rd.date
                    ? "bg-accent border-accent text-white"
                    : "bg-card border-border text-muted"
                }`}
              >
                <span>{fmtLocalDate(rd.date)}</span>
                {rd.score != null && (
                  <span
                    className={`text-[10px] font-normal mt-0.5 ${selectedDate === rd.date ? "opacity-80" : "text-faint"}`}
                  >
                    FICO {rd.score}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Account list */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            Credit Accounts ({sorted.length})
          </p>
          {selectedDate && (
            <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
              As of {fmtLocalDate(selectedDate)}
            </span>
          )}
        </div>
        <div className="divide-y divide-border">
          {sorted.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              displayBalance={selectedDate ? balanceAt(account, selectedDate) : account.balance}
              history={historyFor(account)}
            />
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-between text-xs text-muted">
          <span>Total balance</span>
          <span className="font-bold text-foreground tabular-nums">
            {fmtMoney(totalBalance, { decimals: 0 })}
          </span>
        </div>
      </div>
    </div>
  );
}
