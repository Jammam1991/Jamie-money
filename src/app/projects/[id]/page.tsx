import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import ProjectClient from "@/components/ProjectClient";
import { getProjects } from "@/lib/store";
import { PAGES } from "@/lib/pages";
import { jamiePageState, pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { comingSoon } = await pageGate("projects");
  if (comingSoon) return <ComingSoon title="Projects" />;

  const { id } = await params;
  const [projects, { removed }] = await Promise.all([getProjects(), jamiePageState()]);

  if (!projects) {
    return (
      <div>
        <BackLink />
        <Card className="text-[14px] text-muted">
          This project couldn&apos;t be loaded just now. Give it a moment and
          refresh the page.
        </Card>
      </div>
    );
  }

  // Deleted, or an old link — back to the list rather than an empty screen.
  const project = projects.find((p) => p.id === id);
  if (!project) redirect("/projects");

  // The pages Jamie can actually open, for the "goes with this page" link. One
  // Chris has taken off his screen would only bounce him back to My Cash.
  const pages = PAGES.filter(
    (p) => p.key !== "home" && p.key !== "projects" && !removed.includes(p.key)
  ).map((p) => ({ href: p.href, label: p.label }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <BackLink />
      <ProjectClient initial={project} pages={pages} today={today} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/projects"
      className="-mt-1 mb-3 inline-flex items-center gap-1 text-[14px] text-muted"
    >
      <ChevronLeft size={16} />
      All projects
    </Link>
  );
}
