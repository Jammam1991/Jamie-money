import { PageTitle } from "@/components/ui";
import CompareClient from "@/components/CompareClient";
import { requireVisible } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  await requireVisible("compare");
  return (
    <div>
      <PageTitle>Job vs Business</PageTitle>
      <CompareClient />
    </div>
  );
}
