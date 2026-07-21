import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import { getDebts } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const [debts, admin] = await Promise.all([getDebts(), isAdmin()]);

  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <DebtClient initialDebts={debts} admin={admin} />
    </div>
  );
}
