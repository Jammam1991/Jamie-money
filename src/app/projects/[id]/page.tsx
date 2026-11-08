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
  const { id } = await params;
  const [projects, { removed }] = await Promise.all([getProjects(), jamiePageState()]);

  // A legal matter lives under Legal, so it opens (or doesn't) with that page.
  const legal = projects?.find((p) => p.id === id)?.area === "legal";
  const { comingSoon } = await pageGate(legal ? "legal" : "projects");
  if (comingSoon) return <ComingSoon title={legal ? "Legal" : "Projects"} />;

  if (!projects) {
    return (
      <div>
        <BackLink legal={false} />
        <Card className="text-[14px] text-muted">
          This project couldn&apos;t be loaded just now. Give it a moment and
          refresh the page.
        </Card>
      </div>
    );
  }

  // Deleted, or an old link — back to the list rather than an empty screen.
  const project = projects.find((p) => p.id === id);
  if (!project) redirect(legal ? "/legal" : "/projects");

  // The pages Jamie can actually open, for the "goes with this page" link. One
  // Chris has taken off his screen would only bounce him back to My Cash.
  const pages = PAGES.filter(
    (p) => p.key !== "home" && p.key !== "projects" && p.key !== "legal" && !removed.includes(p.key)
  ).map((p) => ({ href: p.href, label: p.label }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <BackLink legal={legal} />
      <ProjectClient initial={project} pages={pages} today={today} />
    </div>
  );
}

function BackLink({ legal }: { legal: boolean }) {
  return (
    <Link
      href={legal ? "/legal" : "/projects"}
      className="-mt-1 mb-3 inline-flex items-center gap-1 text-[14px] text-muted"
    >
      <ChevronLeft size={16} />
      {legal ? "All legal matters" : "All projects"}
    </Link>
  );
}
