import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import BillsClient from "@/components/BillsClient";
import {
  getBills,
  getPaidBillIdsThisMonth,
  getRolloverBillIds,
  getWeeklyIncome,
} from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const role = await getRole();
  if (!role) redirect("/login");
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
        admin={role === "admin"}
      />
    </div>
  );
}
