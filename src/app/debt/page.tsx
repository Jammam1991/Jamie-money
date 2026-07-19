import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import { getDebts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const debts = await getDebts();

  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <DebtClient initialDebts={debts} />
    </div>
  );
}
