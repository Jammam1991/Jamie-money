import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import LegalClient from "@/components/LegalClient";
import { getProjects } from "@/lib/store";
import { pageGate } from "@/lib/visibility";
import { importMoneyAppLegalOnce } from "@/lib/legalImport";

export const dynamic = "force-dynamic";

export default async function LegalPage() {
  const { comingSoon } = await pageGate("legal");
  if (comingSoon) return <ComingSoon title="Legal" />;

  // The Money App's legal cases, copied in the first time (see legalImport.ts).
  await importMoneyAppLegalOnce();
  const projects = await getProjects();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

  return (
    <div>
      <PageTitle>Legal</PageTitle>
      <p className="-mt-2 mb-5 text-[14px] text-muted">
        Every case and law firm in one place — who&apos;s handling it, the case number, what&apos;s coming up and what it&apos;s costing.
      </p>
      {projects ? (
        <LegalClient matters={projects.filter((p) => p.area === "legal")} today={today} />
      ) : (
        <Card className="text-[14px] text-muted">
          Your legal matters couldn&apos;t be loaded just now. Give it a moment and refresh the page.
        </Card>
      )}
    </div>
  );
}
