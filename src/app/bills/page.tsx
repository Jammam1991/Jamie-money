import { PageTitle } from "@/components/ui";
import BillsClient from "@/components/BillsClient";
import {
  getBills,
  getPaidBillIdsThisMonth,
  getRolloverBillIds,
  getWeeklyIncome,
} from "@/lib/store";
import { isViewingAsJamie } from "@/lib/auth";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const { role, comingSoon } = await pageGate("bills");
  if (comingSoon) return <ComingSoon title="My Bills" />;
  // "View as Jamie" hides the editing tools too, so Chris sees exactly the
  // read-only page Jamie gets.
  const viewingAsJamie = await isViewingAsJamie();
  const [bills, income, paidIds, rolloverIds] = await Promise.all([
    getBills(),
    getWeeklyIncome(),
    getPaidBillIdsThisMonth(),
    getRolloverBillIds(),
  ]);

  return (
    <div>
      <PageTitle>My Bills</PageTitle>
      <BillsClient
        initialBills={bills}
        initialIncome={income}
        initialPaidIds={paidIds}
        initialRolloverIds={rolloverIds}
        admin={role === "admin" && !viewingAsJamie}
      />
    </div>
  );
}
