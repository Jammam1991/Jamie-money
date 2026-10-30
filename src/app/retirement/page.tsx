import { Card, PageTitle } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import RetirementPlanClient from "@/components/RetirementPlanClient";
import { pageGate } from "@/lib/visibility";
import { getPlanBase } from "@/lib/retirementPlanFeed";

export const dynamic = "force-dynamic";

export default async function RetirementPage() {
  const { comingSoon } = await pageGate("retirement");
  if (comingSoon) return <ComingSoon title="401k Plan" />;

  const { base, error } = await getPlanBase();

  return (
    <div>
      <PageTitle>401k Plan</PageTitle>
      {base ? (
        <RetirementPlanClient base={base} />
      ) : (
        <Card>
          <p className="text-[15px] font-medium">Nothing to show yet</p>
          <p className="mt-1 text-[14px] text-muted">{error}</p>
        </Card>
      )}
    </div>
  );
}
