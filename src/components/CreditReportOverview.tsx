"use client";

// The Credit Report summary, copied from Money App's own screen so both apps
// show the same thing: the negative items up top, the tap-open snapshot tiles,
// the score factors, and how FICO weighs each piece.

import { useMemo, useState } from "react";
import {
  FICO_WEIGHTS,
  NEGATIVE_KIND_LABEL,
  fmtLocalDate,
  fmtMoney,
  todayLocalISO,
  type ReportAccount,
  type ReportSnapshot,
  type ScoreReasons,
} from "@/lib/creditReport";
import type { CreditAccount } from "@/lib/store";

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-pos",
  warn: "text-warn",
  bad: "text-neg",
  neutral: "text-foreground",
};

const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-rose-400",
  neutral: "bg-slate-400",
};

function monthsBetween(fromISO: string, toISO: string): number {
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

type DetailKey =
  | "total"
  | "cards"
  | "loans"
  | "payments"
  | "ontime"
  | "interest"
  | "negatives"
  | "inquiries"
  | "business";

type DetailRow = {
  key: string;
  name: string;
  sub?: string | null;
  value: string;
  valueSub?: string | null;
  tone?: Tone;
  dim?: boolean;
};

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
  open,
  onToggle,
  count,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  open: boolean;
  onToggle: () => void;
  /** Rows behind the tile — 0 means nothing to expand, so it stays static. */
  count: number;
}) {
  if (count === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
        <p className={`text-lg font-bold tabular-nums mt-0.5 ${TONE_TEXT[tone]}`}>{value}</p>
        {sub && <p className="text-[10px] text-faint mt-0.5 leading-tight">{sub}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
        open ? "border-accent/50 bg-accent/10" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
        <svg
          className={`w-3 h-3 text-faint shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="text-[10px] text-faint mt-0.5 leading-tight">{sub}</p>}
    </button>
  );
}

function DetailPanel({
  title,
  note,
  rows,
  onClose,
}: {
  title: string;
  note?: string;
  rows: DetailRow[];
  onClose: () => void;
}) {
  return (
    <div className="mt-2.5 rounded-xl border border-accent/40 bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{title}</p>
          {note && <p className="text-[10px] text-faint mt-0.5 leading-tight">{note}</p>}
        </div>
        <button
          onClick={onClose}
          className="text-faint text-sm leading-none shrink-0"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {rows.map((r) => (
          <div
            key={r.key}
            className={`flex items-center gap-3 px-3.5 py-2 ${r.dim ? "opacity-50" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{r.name}</p>
              {r.sub && <p className="text-[10px] text-faint truncate">{r.sub}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-bold tabular-nums ${TONE_TEXT[r.tone ?? "neutral"]}`}>
                {r.value}
              </p>
              {r.valueSub && <p className="text-[10px] text-faint">{r.valueSub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type PaymentDetail = {
  name: string;
  months: number;
  missed: number;
};

export function CreditReportOverview({
  snapshot,
  accounts,
  onTimeMonths,
  totalMonths,
  paymentDetail,
}: {
  snapshot: ReportSnapshot;
  accounts: CreditAccount[];
  onTimeMonths: number;
  totalMonths: number;
  paymentDetail: PaymentDetail[];
}) {
  const [showReasons, setShowReasons] = useState(false);
  const [openTile, setOpenTile] = useState<DetailKey | null>(null);

  const { reasons, negatives, summary, inquiries, reportAccounts } = snapshot;
  const today = todayLocalISO();

  // ── Balances by group, straight off the bureau's own account types ─────────
  const groups = useMemo(() => {
    const sum = (pred: (a: ReportAccount) => boolean) =>
      reportAccounts.filter(pred).reduce((s, a) => s + (a.balance ?? 0), 0);
    return {
      total: reportAccounts.reduce((s, a) => s + (a.balance ?? 0), 0),
      cards: sum((a) => a.group === "credit_card"),
      loans: sum((a) => a.group === "loan"),
      business: sum((a) => a.group === "business"),
      other: sum((a) => a.group === "other"),
      cardCount: reportAccounts.filter((a) => a.group === "credit_card").length,
      loanCount: reportAccounts.filter((a) => a.group === "loan").length,
      businessCount: reportAccounts.filter((a) => a.group === "business").length,
    };
  }, [reportAccounts]);

  // Monthly payment: only open accounts still bill you.
  const monthlyPayment = reportAccounts
    .filter((a) => a.open)
    .reduce((s, a) => s + (a.monthlyPayment ?? 0), 0);

  // APR only lives in the app's own debt records — the bureau never reports it.
  const interestPerYear = accounts.reduce((s, a) => s + (a.balance * (a.apr || 0)) / 100, 0);
  const accountsWithApr = accounts.filter((a) => a.apr > 0).length;

  const usagePct = summary?.usagePct ?? null;
  const usageTone: Tone =
    usagePct == null ? "neutral" : usagePct >= 70 ? "bad" : usagePct >= 30 ? "warn" : "good";

  const onTimePct = totalMonths > 0 ? Math.round((onTimeMonths / totalMonths) * 100) : null;
  const onTimeTone: Tone =
    onTimePct == null ? "neutral" : onTimePct === 100 ? "good" : onTimePct >= 95 ? "warn" : "bad";

  const recentInquiries = inquiries.filter(
    (q) => q.date != null && monthsBetween(q.date, today) <= 12,
  );
  const liveInquiries = inquiries.filter((q) => !q.expires || q.expires >= today);

  const distinctGroups = new Set(reportAccounts.map((a) => a.group)).size;

  // ── FICO's five weighted categories, filled in from this report ────────────
  const weightDetail: Record<string, { text: string; tone: Tone }> = {
    payment_history: negatives.length
      ? {
          text: `${negatives.length} derogatory item${negatives.length > 1 ? "s" : ""} on file`,
          tone: "bad",
        }
      : onTimePct != null
        ? { text: `${onTimePct}% of reported months paid on time`, tone: onTimeTone }
        : { text: "No late payments reported", tone: "good" },
    amounts_owed:
      usagePct != null
        ? {
            text: `${usagePct}% of your credit limit in use${
              summary?.creditLimit ? ` (${fmtMoney(summary.creditLimit, { decimals: 0 })} total)` : ""
            }`,
            tone: usageTone,
          }
        : { text: `${fmtMoney(groups.cards, { decimals: 0 })} on cards`, tone: "neutral" },
    length_of_history: summary?.oldestAccount
      ? {
          text: `Oldest ${summary.oldestAccount}${
            summary.averageAccountAge ? ` · average ${summary.averageAccountAge}` : ""
          }`,
          tone: "neutral",
        }
      : { text: "Not reported", tone: "neutral" },
    new_credit: {
      text: `${recentInquiries.length} hard inquir${
        recentInquiries.length === 1 ? "y" : "ies"
      } in the last 12 months`,
      tone: recentInquiries.length >= 4 ? "bad" : recentInquiries.length >= 2 ? "warn" : "good",
    },
    credit_mix: {
      text: `${distinctGroups} type${distinctGroups === 1 ? "" : "s"} of credit reporting`,
      tone: distinctGroups >= 2 ? "good" : "warn",
    },
  };

  const hurtingCount = reasons?.hurting.length ?? 0;
  const helpingCount = reasons?.helping.length ?? 0;

  // ── What each tile expands into ───────────────────────────────────────────
  const accountRows = (pick: (a: ReportAccount) => boolean): DetailRow[] =>
    reportAccounts
      .filter((a) => pick(a) && (a.balance ?? 0) !== 0)
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
      .map((a, i) => ({
        key: `${a.name}-${i}`,
        name: a.name,
        sub: [
          a.accountType,
          a.open ? null : "closed",
          a.creditLimit ? `${fmtMoney(a.creditLimit, { decimals: 0 })} limit` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        value: fmtMoney(a.balance ?? 0, { decimals: 0 }),
        valueSub:
          a.creditLimit && a.creditLimit > 0
            ? `${Math.round(((a.balance ?? 0) / a.creditLimit) * 100)}% used`
            : null,
        dim: !a.open,
      }));

  const details: Record<DetailKey, { title: string; note?: string; rows: DetailRow[] }> = {
    total: {
      title: "Everything reported",
      note: "Every account on the report carrying a balance",
      rows: accountRows(() => true),
    },
    cards: {
      title: "Credit cards",
      note: "Revolving and charge accounts",
      rows: accountRows((a) => a.group === "credit_card"),
    },
    loans: {
      title: "Loans",
      note: "Auto, personal and other installment debt",
      rows: accountRows((a) => a.group === "loan"),
    },
    business: {
      title: "Business loans",
      note: "On the report, but not personal FICO debt",
      rows: accountRows((a) => a.group === "business"),
    },
    payments: {
      title: "Monthly minimums",
      note: "What open accounts bill each month",
      rows: reportAccounts
        .filter((a) => a.open && (a.monthlyPayment ?? 0) > 0)
        .sort((a, b) => (b.monthlyPayment ?? 0) - (a.monthlyPayment ?? 0))
        .map((a, i) => ({
          key: `pay-${a.name}-${i}`,
          name: a.name,
          sub: a.accountType,
          value: `${fmtMoney(a.monthlyPayment ?? 0, { decimals: 0 })}/mo`,
        })),
    },
    ontime: {
      title: "Payment record",
      note: "Months this app has a reported status for",
      rows: paymentDetail.map((d, i) => ({
        key: `ot-${d.name}-${i}`,
        name: d.name,
        sub: `${d.months} month${d.months === 1 ? "" : "s"} reported`,
        value: d.missed > 0 ? `${d.missed} missed` : "All on time",
        tone: d.missed > 0 ? "bad" : "good",
      })),
    },
    interest: {
      title: "Estimated interest",
      note: "Balance × the APR saved in this app — the bureau never reports rates",
      rows: accounts
        .filter((a) => a.apr > 0 && a.balance > 0)
        .sort((a, b) => b.balance * b.apr - a.balance * a.apr)
        .map((a) => ({
          key: `int-${a.id}`,
          name: a.name,
          sub: `${fmtMoney(a.balance, { decimals: 0 })} at ${a.apr}% APR`,
          value: `${fmtMoney((a.balance * a.apr) / 100, { decimals: 0 })}/yr`,
          valueSub: `${fmtMoney((a.balance * a.apr) / 1200, { decimals: 0 })}/mo`,
          tone: "warn" as Tone,
        })),
    },
    negatives: {
      title: "Negative items",
      note: "Most damaging first",
      rows: negatives.map((n, i) => ({
        key: `neg-${n.name}-${i}`,
        name: n.name,
        sub: n.status ?? n.accountType,
        value:
          n.pastDue && n.pastDue > 0
            ? `${fmtMoney(n.pastDue, { decimals: 0 })} past due`
            : n.balance != null && n.balance > 0
              ? fmtMoney(n.balance, { decimals: 0 })
              : NEGATIVE_KIND_LABEL[n.kind],
        valueSub: NEGATIVE_KIND_LABEL[n.kind],
        tone: "bad" as Tone,
      })),
    },
    inquiries: {
      title: "Hard inquiries",
      note: "Each drops off two years after it was made",
      rows: inquiries.map((q, i) => {
        const expired = q.expires != null && q.expires < today;
        return {
          key: `inq-${q.name}-${i}`,
          name: q.name,
          sub: q.businessType,
          value: q.date ? fmtLocalDate(q.date) : "—",
          valueSub: q.expires
            ? `${expired ? "Expired" : "Drops off"} ${fmtLocalDate(q.expires, {
                month: "short",
                year: "numeric",
              })}`
            : "Drops off after 2 years",
          dim: expired,
        };
      }),
    },
  };

  const toggle = (k: DetailKey) => setOpenTile((cur) => (cur === k ? null : k));
  const openDetail = openTile ? details[openTile] : null;

  return (
    <div className="space-y-3">
      {/* ── Negative items — the loudest thing on the page ──────────────────── */}
      {negatives.length > 0 && (
        <div className="rounded-2xl border border-neg/40 bg-neg/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg leading-none">⚠️</span>
            <p className="text-sm font-bold text-neg">
              {negatives.length} negative item{negatives.length > 1 ? "s" : ""} hurting this score
            </p>
          </div>
          <div className="space-y-2">
            {negatives.map((n, i) => (
              <div
                key={`${n.name}-${i}`}
                className="rounded-xl bg-card border border-neg/30 px-3.5 py-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neg bg-neg/10 px-2 py-0.5 rounded">
                    {NEGATIVE_KIND_LABEL[n.kind]}
                  </span>
                  <p className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                    {n.name}
                  </p>
                  {n.pastDue != null && n.pastDue > 0 ? (
                    <span className="text-sm font-bold text-neg tabular-nums">
                      {fmtMoney(n.pastDue, { decimals: 0 })} past due
                    </span>
                  ) : n.balance != null && n.balance > 0 ? (
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {fmtMoney(n.balance, { decimals: 0 })}
                    </span>
                  ) : null}
                </div>
                {n.status && <p className="text-[11px] text-muted mt-1">{n.status}</p>}
                <p className="text-[10px] text-faint mt-1">
                  {[
                    n.accountType,
                    n.responsibility,
                    n.opened ? `opened ${n.opened}` : null,
                    n.closed ? "closed" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-3 leading-tight">
            Paying a collection doesn&apos;t remove it, but most negative marks drop off after
            seven years and hurt less as they age.
          </p>
        </div>
      )}

      {/* ── Snapshot tiles ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            Report summary
          </p>
          <p className="text-[10px] text-faint">as of {fmtLocalDate(snapshot.date)}</p>
        </div>

        <p className="text-[10px] text-faint mb-2">Tap any tile to see what&apos;s behind it.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Tile
            label="Total owed"
            value={fmtMoney(groups.total, { decimals: 0 })}
            sub={`${reportAccounts.length} reported accounts`}
            open={openTile === "total"}
            onToggle={() => toggle("total")}
            count={details.total.rows.length}
          />
          <Tile
            label="Credit cards"
            value={fmtMoney(groups.cards, { decimals: 0 })}
            sub={`${groups.cardCount} cards${usagePct != null ? ` · ${usagePct}% used` : ""}`}
            tone={usageTone}
            open={openTile === "cards"}
            onToggle={() => toggle("cards")}
            count={details.cards.rows.length}
          />
          <Tile
            label="Loans"
            value={fmtMoney(groups.loans, { decimals: 0 })}
            sub={`${groups.loanCount} loan${groups.loanCount === 1 ? "" : "s"}`}
            open={openTile === "loans"}
            onToggle={() => toggle("loans")}
            count={details.loans.rows.length}
          />
          <Tile
            label="Monthly payments"
            value={fmtMoney(monthlyPayment, { decimals: 0 })}
            sub="Minimums on open accounts"
            open={openTile === "payments"}
            onToggle={() => toggle("payments")}
            count={details.payments.rows.length}
          />
          <Tile
            label="On-time payments"
            value={onTimePct != null ? `${onTimePct}%` : "—"}
            sub={
              onTimePct != null
                ? `${onTimeMonths} of ${totalMonths} reported months`
                : "No payment history yet"
            }
            tone={onTimeTone}
            open={openTile === "ontime"}
            onToggle={() => toggle("ontime")}
            count={details.ontime.rows.length}
          />
          <Tile
            label="Interest / yr"
            value={interestPerYear > 0 ? fmtMoney(interestPerYear, { decimals: 0 }) : "—"}
            sub={
              accountsWithApr > 0
                ? `Est. from ${accountsWithApr} saved APR${accountsWithApr === 1 ? "" : "s"}`
                : "Add APRs to estimate"
            }
            tone={interestPerYear > 0 ? "warn" : "neutral"}
            open={openTile === "interest"}
            onToggle={() => toggle("interest")}
            count={details.interest.rows.length}
          />
          <Tile
            label="Negative items"
            value={String(negatives.length)}
            sub={
              summary?.accountsEverLate != null
                ? `${summary.accountsEverLate} accounts ever late`
                : undefined
            }
            tone={negatives.length > 0 ? "bad" : "good"}
            open={openTile === "negatives"}
            onToggle={() => toggle("negatives")}
            count={details.negatives.rows.length}
          />
          <Tile
            label="Hard inquiries"
            value={String(liveInquiries.length)}
            sub={`${recentInquiries.length} in the last 12 months`}
            tone={recentInquiries.length >= 4 ? "bad" : recentInquiries.length >= 2 ? "warn" : "good"}
            open={openTile === "inquiries"}
            onToggle={() => toggle("inquiries")}
            count={details.inquiries.rows.length}
          />
        </div>

        {/* Business debt is on the report but doesn't drive the personal score. */}
        {groups.business > 0 && (
          <button
            type="button"
            onClick={() => toggle("business")}
            className={`mt-2.5 w-full text-left rounded-xl border px-3.5 py-3 flex items-center gap-3 transition-colors ${
              openTile === "business"
                ? "border-accent/50 bg-accent/10"
                : "border-border bg-surface"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Business loans — tracked separately
              </p>
              <p className="text-[10px] text-faint mt-0.5">
                {groups.businessCount} account{groups.businessCount === 1 ? "" : "s"} · shown here
                for completeness, not counted as personal FICO debt
              </p>
            </div>
            <p className="text-lg font-bold text-foreground tabular-nums shrink-0">
              {fmtMoney(groups.business, { decimals: 0 })}
            </p>
            <svg
              className={`w-3.5 h-3.5 text-faint shrink-0 transition-transform ${openTile === "business" ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {openDetail && (
          <DetailPanel
            title={openDetail.title}
            note={openDetail.note}
            rows={openDetail.rows}
            onClose={() => setOpenTile(null)}
          />
        )}
      </div>

      {/* ── Score factors, collapsed behind one button ─────────────────────── */}
      {reasons && (hurtingCount > 0 || helpingCount > 0) && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                What&apos;s affecting this score
              </p>
              <p className="text-sm text-foreground mt-1">
                <span className="font-bold text-neg">{hurtingCount} hurting</span>
                <span className="text-faint mx-1.5">·</span>
                <span className="font-bold text-pos">{helpingCount} helping</span>
              </p>
              {hurtingCount > 0 && (
                <p className="text-[11px] text-muted mt-1">
                  {reasons.hurting.map((f) => f.title).join(" · ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowReasons((v) => !v)}
              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-accent text-white shrink-0"
            >
              {showReasons ? "Hide reasons" : "Check out reasons"}
            </button>
          </div>

          {showReasons && (
            <div className="mt-4 space-y-4">
              {reasons.hurting.length > 0 && (
                <ReasonGroup title="What's hurting" factors={reasons.hurting} tone="bad" />
              )}
              {reasons.helping.length > 0 && (
                <ReasonGroup title="What's helping" factors={reasons.helping} tone="good" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── How FICO weights each piece ────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-3">
          What makes up a FICO score
        </p>
        <div className="space-y-2.5">
          {FICO_WEIGHTS.map((w) => {
            const detail = weightDetail[w.key];
            return (
              <div key={w.key} className="flex items-center gap-3">
                <div className="w-[132px] shrink-0">
                  <p className="text-xs font-semibold text-foreground leading-tight">{w.label}</p>
                  <p className="text-[10px] text-faint">{w.weight}% of your score</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full ${TONE_BAR[detail.tone]}`}
                      style={{ width: `${w.weight * 2.6}%` }}
                    />
                  </div>
                  <p className={`text-[11px] mt-1 leading-tight ${TONE_TEXT[detail.tone]}`}>
                    {detail.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReasonGroup({
  title,
  factors,
  tone,
}: {
  title: string;
  factors: ScoreReasons["hurting"];
  tone: "good" | "bad";
}) {
  return (
    <div>
      <p
        className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
          tone === "bad" ? "text-neg" : "text-pos"
        }`}
      >
        {title}
      </p>
      <div className="space-y-2">
        {factors.map((f, i) => (
          <div
            key={`${f.title}-${i}`}
            className={`rounded-xl border px-3.5 py-3 ${
              tone === "bad" ? "border-neg/30 bg-neg/10" : "border-pos/30 bg-pos/10"
            }`}
          >
            <p className="text-sm font-semibold text-foreground">{f.title}</p>
            {f.bullets.length > 0 && (
              <ul className="mt-1.5 space-y-1 list-disc list-outside pl-4">
                {f.bullets.map((b, j) => (
                  <li key={j} className="text-[11px] text-muted leading-snug">
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
