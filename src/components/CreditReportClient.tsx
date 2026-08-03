"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui";
import { money, type Debt } from "@/lib/data";
import type { CreditSnapshot, FicoScoreEntry } from "@/lib/store";

// Plain-English label for a credit score.
function scoreLabel(score: number): string {
  if (score >= 800) return "Excellent";
  if (score >= 740) return "Very good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Needs work";
}

function scoreColor(score: number): string {
  if (score >= 740) return "var(--good)";
  if (score >= 670) return "#fbbf24";
  if (score >= 580) return "#ff6b35";
  return "#dc2626";
}

// "2026-05-03" → "May 3, 2026". Split by hand so the date never slides a day
// because of time zones.
function niceDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export default function CreditReportClient({
  scores,
  snapshots,
  debts,
  admin,
  moneyAppReady,
}: {
  scores: FicoScoreEntry[];
  snapshots: CreditSnapshot[];
  debts: Debt[];
  admin: boolean;
  moneyAppReady: boolean;
}) {
  // Scores arrive oldest first, so the chart reads left to right.
  const latest = scores.length > 0 ? scores[scores.length - 1] : null;
  const prior = scores.length > 1 ? scores[scores.length - 2] : null;
  const empty = scores.length === 0 && snapshots.length === 0;

  return (
    <div className="space-y-4">
      <ScoreHeadline latest={latest} prior={prior} />

      {admin && <SyncButton ready={moneyAppReady} />}

      {scores.length > 0 && <ScoreHistory scores={scores} />}

      {debts.length > 0 && <WhatYouOwe debts={debts} snapshots={snapshots} />}

      {snapshots.length > 0 && (
        <Card>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-muted">
            <FileText size={15} />
            Report history
          </p>
          <div className="space-y-2">
            {snapshots.map((s) => (
              <SnapshotRow key={s.date} snapshot={s} />
            ))}
          </div>
        </Card>
      )}

      {empty && (
        <Card>
          <p className="text-sm text-muted">
            Nothing here yet. Credit reports get uploaded in Money App — this
            page shows what it found: the score over time, what&apos;s owed, and
            any missed payments.
          </p>
          {admin && !moneyAppReady && (
            <p className="mt-2 text-sm text-warn">
              Money App isn&apos;t connected yet. Add MONEYAPP_API_URL (or
              MONEYAPP_URL) and MONEYAPP_API_KEY in Vercel, redeploy, then tap
              sync.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Pull the latest numbers over from Money App ───────────────────────────────
function SyncButton({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/moneyapp/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setNote(body.error ?? "Couldn't reach Money App.");
      } else {
        setNote(
          `Updated ${body.synced} account${body.synced === 1 ? "" : "s"}` +
            (body.scores ? `, ${body.scores} score${body.scores === 1 ? "" : "s"}` : "") +
            "."
        );
        router.refresh();
      }
    } catch {
      setNote("Couldn't reach Money App.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm text-muted disabled:opacity-50"
        onClick={sync}
        disabled={busy || !ready}
      >
        <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
        {busy ? "Getting the latest…" : "Sync from Money App"}
      </button>
      {note && <p className="mt-2 text-center text-xs text-muted">{note}</p>}
      {!ready && (
        <p className="mt-2 text-center text-xs text-muted">
          Money App isn&apos;t connected yet.
        </p>
      )}
    </div>
  );
}

// ── The big number at the top ─────────────────────────────────────────────────
function ScoreHeadline({
  latest,
  prior,
}: {
  latest: FicoScoreEntry | null;
  prior: FicoScoreEntry | null;
}) {
  if (!latest) {
    return (
      <Card>
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <Gauge size={15} />
          Credit score
        </p>
        <p className="mt-2 text-sm text-muted">
          No score yet. It fills in from Money App.
        </p>
      </Card>
    );
  }

  const change = prior ? latest.score - prior.score : 0;

  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <Gauge size={15} />
        Credit score
      </p>
      <div className="mt-2 flex items-baseline justify-between">
        <span
          className="text-4xl font-medium"
          style={{ color: scoreColor(latest.score) }}
        >
          {latest.score}
        </span>
        <span className="text-[13px] text-muted">{scoreLabel(latest.score)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">As of {niceDate(latest.scoredOn)}</p>
      {prior && (
        <p
          className="mt-2 flex items-center gap-1.5 text-[13px]"
          style={{
            color:
              change > 0 ? "var(--good)" : change < 0 ? "var(--warn)" : "var(--muted)",
          }}
        >
          {change > 0 ? (
            <TrendingUp size={15} />
          ) : change < 0 ? (
            <TrendingDown size={15} />
          ) : null}
          {change === 0
            ? `No change since ${niceDate(prior.scoredOn)}`
            : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} point${
                Math.abs(change) === 1 ? "" : "s"
              } since ${niceDate(prior.scoredOn)}`}
        </p>
      )}
    </Card>
  );
}

// ── Score history: a small line chart plus the list ───────────────────────────
function ScoreHistory({ scores }: { scores: FicoScoreEntry[] }) {
  return (
    <Card>
      <p className="mb-2 text-[13px] text-muted">Score history</p>
      <ScoreChart scores={scores} />
      <div className="mt-3 space-y-2">
        {[...scores].reverse().map((s) => (
          <div
            key={s.scoredOn}
            className="flex items-center justify-between text-[15px]"
          >
            <span className="text-muted">{niceDate(s.scoredOn)}</span>
            <span className="font-medium" style={{ color: scoreColor(s.score) }}>
              {s.score}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// A simple line chart of the scores over time.
function ScoreChart({ scores }: { scores: FicoScoreEntry[] }) {
  const values = scores.map((s) => s.score);
  const lo = Math.min(...values) - 10;
  const hi = Math.max(...values) + 10;
  const span = Math.max(1, hi - lo);

  const x = (i: number) =>
    scores.length === 1 ? 150 : 10 + (i / (scores.length - 1)) * 280;
  const y = (v: number) => 90 - ((v - lo) / span) * 80;

  const points = scores.map((s, i) => `${x(i)},${y(s.score)}`).join(" ");
  const last = scores[scores.length - 1];

  return (
    <div className="rounded-xl bg-tint p-2">
      <svg viewBox="0 0 300 100" className="h-24 w-full" aria-hidden="true">
        {scores.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke={scoreColor(last.score)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {scores.map((s, i) => (
          <circle
            key={s.scoredOn}
            cx={x(i)}
            cy={y(s.score)}
            r={3}
            fill={scoreColor(s.score)}
          />
        ))}
      </svg>
      <div className="flex justify-between px-1 text-[11px] text-muted">
        <span>{niceDate(scores[0].scoredOn)}</span>
        {scores.length > 1 && <span>{niceDate(last.scoredOn)}</span>}
      </div>
    </div>
  );
}

// ── What's owed right now, and how it moved ───────────────────────────────────
function WhatYouOwe({
  debts,
  snapshots,
}: {
  debts: Debt[];
  snapshots: CreditSnapshot[];
}) {
  const total = debts.reduce((s, d) => s + d.balance, 0);
  const minTotal = debts.reduce((s, d) => s + d.minPayment, 0);
  // Compare against the oldest snapshot still on record, so the line reads
  // "since the first report we have" rather than "since the newest one",
  // which would usually be today's numbers.
  const oldest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const change = oldest ? total - oldest.totalBalance : 0;

  return (
    <>
      <div className="rounded-2xl bg-warn-bg p-4">
        <p className="text-[13px] text-warn">Owed right now</p>
        <p className="text-3xl font-medium text-warn">{money(total)}</p>
        <p className="mt-1 text-[13px] text-warn">
          Across {debts.length} account{debts.length === 1 ? "" : "s"}
        </p>
        {oldest && change !== 0 && (
          <p className="mt-2 text-[13px] text-warn">
            {change < 0 ? "Down" : "Up"} {money(Math.abs(change))} since{" "}
            {niceDate(oldest.date)}.
          </p>
        )}
      </div>

      <Card>
        <p className="mb-2 text-[13px] text-muted">The accounts</p>
        <div className="space-y-3">
          {debts.map((d) => (
            <div key={d.id}>
              <div className="flex items-center justify-between font-medium">
                <span className="truncate">{d.name}</span>
                <span>{money(d.balance)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {d.apr}% interest · {money(d.minPayment)}/mo minimum
              </p>
            </div>
          ))}
        </div>
        {minTotal > 0 && (
          <p className="mt-3 text-xs text-muted">
            Minimum payments add up to {money(minTotal)} a month.
          </p>
        )}
      </Card>
    </>
  );
}

// ── One report in the history, tap to open ────────────────────────────────────
function SnapshotRow({ snapshot }: { snapshot: CreditSnapshot }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-tint p-3">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
        <span className="flex-1">
          <span className="block text-[15px] font-medium">
            {niceDate(snapshot.date)}
          </span>
          <span className="block text-xs text-muted">
            {money(snapshot.totalBalance)} across {snapshot.accounts.length}{" "}
            account{snapshot.accounts.length === 1 ? "" : "s"}
          </span>
        </span>
        {snapshot.missedCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 text-xs"
            style={{ color: "var(--warn)" }}
          >
            <AlertTriangle size={13} />
            {snapshot.missedCount} missed
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {snapshot.accounts.map((a) => (
            <div
              key={a.debtId}
              className="flex items-center justify-between text-[13px]"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span className="truncate">{a.name}</span>
                {a.missedPayment && (
                  <AlertTriangle
                    size={12}
                    className="shrink-0"
                    style={{ color: "var(--warn)" }}
                  />
                )}
              </span>
              <span>{money(a.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
