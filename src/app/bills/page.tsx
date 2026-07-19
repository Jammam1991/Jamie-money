import { PageTitle } from "@/components/ui";
import BillsClient from "@/components/BillsClient";
import { getBills, getWeeklyIncome } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const [bills, income] = await Promise.all([getBills(), getWeeklyIncome()]);

  return (
    <div>
      <PageTitle>Bills</PageTitle>
      <BillsClient initialBills={bills} initialIncome={income} />
    </div>
  );
}
