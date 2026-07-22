import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import BillsClient from "@/components/BillsClient";
import { getBills, getWeeklyIncome } from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const [bills, income] = await Promise.all([getBills(), getWeeklyIncome()]);

  return (
    <div>
      <PageTitle>Bills</PageTitle>
      <BillsClient
        initialBills={bills}
        initialIncome={income}
        admin={role === "admin"}
      />
    </div>
  );
}
