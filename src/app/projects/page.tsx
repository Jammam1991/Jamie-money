import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import ProjectsClient from "@/components/ProjectsClient";
import { getProjects } from "@/lib/store";
import { pageGate } from "@/lib/visibility";
import { importMoneyAppLegalOnce } from "@/lib/legalImport";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { comingSoon } = await pageGate("projects");
  if (comingSoon) return <ComingSoon title="Projects" />;

  await importMoneyAppLegalOnce();
  const projects = await getProjects();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageTitle>Projects</PageTitle>
      <p className="-mt-2 mb-5 text-[14px] text-muted">
        Everything you&apos;re working on, in one place. Tap one to add what&apos;s
        going on. 👇
      </p>
      {projects ? (
        // Legal matters have their own page; they'd only crowd this list twice.
        <ProjectsClient initial={projects.filter((p) => p.area !== "legal")} today={today} />
      ) : (
        <Card className="text-[14px] text-muted">
          Your projects couldn&apos;t be loaded just now. Give it a moment and
          refresh the page.
        </Card>
      )}
    </div>
  );
}
