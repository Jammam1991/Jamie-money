import { PageTitle } from "@/components/ui";
import CreditReportClient from "@/components/CreditReportClient";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";
import { getCreditSnapshots, getDebts, getFicoHistory } from "@/lib/store";
import { moneyAppReady } from "@/lib/moneyapp";

export const dynamic = "force-dynamic";

export default async function CreditReportPage() {
  const { role, comingSoon } = await pageGate("credit-report");
  if (comingSoon) return <ComingSoon title="Credit Report" />;

  const [scores, snapshots, debts] = await Promise.all([
    getFicoHistory(),
    getCreditSnapshots(),
    getDebts(),
  ]);

  return (
    <div>
      <PageTitle>Credit Report</PageTitle>
      <CreditReportClient
        scores={scores}
        snapshots={snapshots}
        debts={debts}
        admin={role === "admin"}
        moneyAppReady={moneyAppReady()}
      />
    </div>
  );
}
