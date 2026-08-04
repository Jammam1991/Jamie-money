import { PageTitle } from "@/components/ui";
import DivorceResponsibilityClient from "@/components/DivorceResponsibilityClient";
import { isJamieView, pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function DivorceResponsibilityPage() {
  const { role, comingSoon } = await pageGate("divorce-responsibility");
  if (comingSoon) return <ComingSoon title="The Debt Story" />;

  // The spending-history section is Chris's working material, so it's off for
  // Jamie AND for Chris while "View as Jamie" is on — that way the toggle is a
  // real check on what Jamie sees, not just a nav preview.
  const jamieView = await isJamieView();

  return (
    <div>
      <PageTitle>The Debt Story</PageTitle>
      <DivorceResponsibilityClient admin={role === "admin" && !jamieView} />
    </div>
  );
}
