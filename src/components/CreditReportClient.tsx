"use client";

// The Credit Report screen, laid out the same way Money App lays out its own:
// the score, the report summary, the debt-to-income calculator, then every
// credit account. All of it is a mirror — the button up top pulls the latest
// import over from Money App and everything below redraws from that.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { FicoSection } from "@/components/FicoSection";
import { CreditReportOverview, type PaymentDetail } from "@/components/CreditReportOverview";
import { CreditAccountList } from "@/components/CreditAccountList";
import { DebtToIncomeCalculator } from "@/components/DebtToIncomeCalculator";
import { fmtLocalDate, type ReportSnapshot } from "@/lib/creditReport";
import type { CreditAccount, DebtSnapshotRow, FicoScoreEntry } from "@/lib/store";

export default function CreditReportClient({
  scores,
  reports,
  accounts,
  snapshotRows,
  onTimeMonths,
  totalMonths,
  paymentDetail,
  admin,
  moneyAppReady,
}: {
  scores: FicoScoreEntry[];
  reports: ReportSnapshot[];
  accounts: CreditAccount[];
  snapshotRows: DebtSnapshotRow[];
  onTimeMonths: number;
  totalMonths: number;
  paymentDetail: PaymentDetail[];
  admin: boolean;
  moneyAppReady: boolean;
}) {
  // The newest report is the one the summary describes.
  const latestReport = reports[0] ?? null;
  const empty = scores.length === 0 && reports.length === 0 && accounts.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <p className="text-xs text-faint">
          {latestReport
            ? `Credit report from ${fmtLocalDate(latestReport.date)}`
            : "Mirrored from Money App"}
        </p>
        {admin && <SyncButton ready={moneyAppReady} />}
      </div>

      <FicoSection history={scores} />

      {latestReport && (
        <CreditReportOverview
          snapshot={latestReport}
          accounts={accounts}
          onTimeMonths={onTimeMonths}
          totalMonths={totalMonths}
          paymentDetail={paymentDetail}
        />
      )}

      <DebtToIncomeCalculator
        reportAccounts={latestReport?.reportAccounts ?? []}
        storageKey="dti-jamie"
      />

      {accounts.length > 0 && (
        <CreditAccountList
          accounts={accounts}
          ficoHistory={scores}
          debtHistory={snapshotRows}
        />
      )}

      {empty && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-sm text-muted">
            Nothing here yet. Credit reports get uploaded in Money App — this page shows what it
            found: the score, what&apos;s owed, and anything hurting the score.
          </p>
          {admin && !moneyAppReady && (
            <p className="mt-2 text-sm text-warn">
              Money App isn&apos;t connected yet. Add MONEYAPP_API_URL (or MONEYAPP_URL) and
              MONEYAPP_API_KEY in Vercel, redeploy, then tap the button above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pull the latest credit report over from Money App ─────────────────────────
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
        const bits = [
          `${body.synced} account${body.synced === 1 ? "" : "s"}`,
          body.reports ? `${body.reports} report${body.reports === 1 ? "" : "s"}` : null,
          body.scores ? `${body.scores} score${body.scores === 1 ? "" : "s"}` : null,
        ].filter(Boolean);
        setNote(`Updated ${bits.join(", ")}.`);
        router.refresh();
      }
    } catch {
      setNote("Couldn't reach Money App.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <button
        className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        onClick={sync}
        disabled={busy || !ready}
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        {busy ? "Getting the latest…" : "Pull latest from Money App"}
      </button>
      {note && <p className="mt-1 text-right text-[11px] text-muted">{note}</p>}
      {!ready && (
        <p className="mt-1 text-right text-[11px] text-muted">Money App isn&apos;t connected yet.</p>
      )}
    </div>
  );
}
