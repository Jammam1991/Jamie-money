import { PageTitle } from "@/components/ui";
import DivorceResponsibilityClient from "@/components/DivorceResponsibilityClient";
import { requireVisible } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function DivorceResponsibilityPage() {
  await requireVisible("divorce-responsibility");

  return (
    <div>
      <PageTitle>Divorce Responsibility</PageTitle>
      <DivorceResponsibilityClient />
    </div>
  );
}
