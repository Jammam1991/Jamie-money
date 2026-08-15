import { PageTitle } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import MarriedVsDivorceClient from "@/components/MarriedVsDivorceClient";
import { getJointTaxSavings, getMarriageBenefits } from "@/lib/marriage";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function MarriedVsDivorcePage() {
  const { role, comingSoon } = await pageGate("married-vs-divorce");
  if (comingSoon) return <ComingSoon title="Married vs Divorce" />;

  const [benefits, jointTax] = await Promise.all([
    getMarriageBenefits(),
    getJointTaxSavings(),
  ]);

  return (
    <div>
      <PageTitle>Married vs Divorce</PageTitle>
      <p className="-mt-2 mb-4 text-[13px] text-muted">
        What staying married is worth in dollars — and why the thing that ties
        our money together isn&apos;t the marriage.
      </p>
      <MarriedVsDivorceClient
        benefits={benefits}
        jointTax={jointTax}
        admin={role === "admin"}
      />
    </div>
  );
}
