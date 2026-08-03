import { PageTitle } from "@/components/ui";
import CreditReportClient from "@/components/CreditReportClient";
import { requireVisible } from "@/lib/visibility";
import { getCreditReports, getFicoHistory } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CreditReportPage() {
  const role = await requireVisible("credit-report");

  const [reports, scores] = await Promise.all([
    getCreditReports(),
    getFicoHistory(),
  ]);

  return (
    <div>
      <PageTitle>Credit Report</PageTitle>
      <CreditReportClient
        initialReports={reports}
        initialScores={scores}
        admin={role === "admin"}
      />
    </div>
  );
}
