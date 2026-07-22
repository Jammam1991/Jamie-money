import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import DebtClient from "@/components/DebtClient";
import { getDebts, hasPlaidItems } from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const [debts, hasBank] = await Promise.all([getDebts(), hasPlaidItems()]);

  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <DebtClient
        initialDebts={debts}
        admin={role === "admin"}
        hasBank={hasBank}
      />
    </div>
  );
}
