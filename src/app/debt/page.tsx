import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import { getDebts, hasPlaidItems } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const [debts, admin, hasBank] = await Promise.all([
    getDebts(),
    isAdmin(),
    hasPlaidItems(),
  ]);

  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <DebtClient initialDebts={debts} admin={admin} hasBank={hasBank} />
    </div>
  );
}
