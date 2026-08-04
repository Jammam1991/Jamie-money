import { PageTitle } from "@/components/ui";
import CreditReportClient from "@/components/CreditReportClient";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";
import {
  getCreditAccounts,
  getCreditReports,
  getDebtSnapshotRows,
  getFicoHistory,
} from "@/lib/store";
import { moneyAppReady } from "@/lib/moneyapp";

export const dynamic = "force-dynamic";

export default async function CreditReportPage() {
  const { role, comingSoon } = await pageGate("credit-report");
  if (comingSoon) return <ComingSoon title="Credit Report" />;

  const [scores, reports, accounts, snapshotRows] = await Promise.all([
    getFicoHistory(),
    getCreditReports(),
    getCreditAccounts(),
    getDebtSnapshotRows(),
  ]);

  // The payment record behind the "on-time payments" tile: every month Money
  // App has a reported status for, and which account each miss came from.
  const paymentDetail = accounts
    .map((a) => {
      const rows = a.moneyappDebtId
        ? snapshotRows.filter((r) => r.moneyappDebtId === a.moneyappDebtId)
        : [];
      return {
        name: a.name,
        months: rows.length,
        missed: rows.filter((r) => r.missedPayment).length,
      };
    })
    .filter((d) => d.months > 0)
    .sort((a, b) => b.missed - a.missed || b.months - a.months);

  const totalMonths = paymentDetail.reduce((s, d) => s + d.months, 0);
  const onTimeMonths = totalMonths - paymentDetail.reduce((s, d) => s + d.missed, 0);

  return (
    <div>
      <PageTitle>Credit Report</PageTitle>
      <CreditReportClient
        scores={scores}
        reports={reports}
        accounts={accounts}
        snapshotRows={snapshotRows}
        onTimeMonths={onTimeMonths}
        totalMonths={totalMonths}
        paymentDetail={paymentDetail}
        admin={role === "admin"}
        moneyAppReady={moneyAppReady()}
      />
    </div>
  );
}
