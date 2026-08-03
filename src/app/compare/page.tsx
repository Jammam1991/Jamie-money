import { PageTitle } from "@/components/ui";
import CompareClient from "@/components/CompareClient";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const { comingSoon } = await pageGate("compare");
  if (comingSoon) return <ComingSoon title="Job vs Business" />;
  return (
    <div>
      <PageTitle>Job vs Business</PageTitle>
      <CompareClient />
    </div>
  );
}
