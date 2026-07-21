import { PageTitle } from "@/components/ui";
import BillsClient from "@/components/BillsClient";
import { getBills, getWeeklyIncome } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const [bills, income, admin] = await Promise.all([
    getBills(),
    getWeeklyIncome(),
    isAdmin(),
  ]);

  return (
    <div>
      <PageTitle>Bills</PageTitle>
      <BillsClient initialBills={bills} initialIncome={income} admin={admin} />
    </div>
  );
}
