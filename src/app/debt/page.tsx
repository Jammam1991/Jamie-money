import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import { getDebts, getMoneyAppFico, hasPlaidItems } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const [debts, admin, hasBank, fico] = await Promise.all([
    getDebts(),
    isAdmin(),
    hasPlaidItems(),
    getMoneyAppFico(),
  ]);

  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <DebtClient initialDebts={debts} admin={admin} hasBank={hasBank} fico={fico} />
    </div>
  );
}
