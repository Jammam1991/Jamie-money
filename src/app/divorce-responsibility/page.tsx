import { PageTitle } from "@/components/ui";
import DivorceResponsibilityClient from "@/components/DivorceResponsibilityClient";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function DivorceResponsibilityPage() {
  const { comingSoon } = await pageGate("divorce-responsibility");
  if (comingSoon) return <ComingSoon title="Divorce Responsibility" />;

  return (
    <div>
      <PageTitle>Divorce Responsibility</PageTitle>
      <DivorceResponsibilityClient />
    </div>
  );
}
