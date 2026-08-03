import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import OverallDebtClient from "@/components/OverallDebtClient";
import { getRole } from "@/lib/auth";
import { getOverallDebts, getOverallContext } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OverallDebtPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const [debts, context] = await Promise.all([
    getOverallDebts(),
    getOverallContext(),
  ]);

  return (
    <div>
      <PageTitle>Overall Debt</PageTitle>
      <OverallDebtClient
        initialDebts={debts}
        initialContext={context}
        admin={role === "admin"}
      />
    </div>
  );
}
