import { PageTitle } from "@/components/ui";
import BillsClient from "@/components/BillsClient";
import OwedClient from "@/components/OwedClient";
import {
  getAdvances,
  getBills,
  getDefaultLimit,
  getWeeklyIncome,
} from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const [bills, income, admin, advances, limit] = await Promise.all([
    getBills(),
    getWeeklyIncome(),
    isAdmin(),
    getAdvances(),
    getDefaultLimit(),
  ]);

  return (
    <div>
      <PageTitle>Bills</PageTitle>
      <BillsClient initialBills={bills} initialIncome={income} admin={admin} />

      <h2 className="mb-3 mt-8 text-[13px] font-medium text-muted">
        Covering for Jamie
      </h2>
      <OwedClient initialAdvances={advances} initialLimit={limit} admin={admin} />
    </div>
  );
}
