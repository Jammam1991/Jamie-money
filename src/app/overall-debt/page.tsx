import { PageTitle } from "@/components/ui";
import OverallDebtClient from "@/components/OverallDebtClient";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";
import { getOverallDebts, getOverallContext, getOverallDebtPayments } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OverallDebtPage() {
  const { role, comingSoon } = await pageGate("overall-debt");
  if (comingSoon) return <ComingSoon title="Overall Debt" />;

  const [debts, context, payments] = await Promise.all([
    getOverallDebts(),
    getOverallContext(),
    getOverallDebtPayments(),
  ]);

  return (
    <div>
      <PageTitle>Overall Debt</PageTitle>
      <OverallDebtClient
        initialDebts={debts}
        initialContext={context}
        initialPayments={payments}
        admin={role === "admin"}
      />
    </div>
  );
}
