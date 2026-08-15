import { PageTitle } from "@/components/ui";
import CareerClient from "@/components/CareerClient";
import ComingSoon from "@/components/ComingSoon";
import {
  getCareerPaths,
  getJobApplications,
  getNetworkSources,
  getResumes,
} from "@/lib/careerStore";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function CareerPage() {
  const { comingSoon } = await pageGate("career");
  if (comingSoon) return <ComingSoon title="Career" />;

  const [paths, resumes, applications, sources] = await Promise.all([
    getCareerPaths(),
    getResumes(),
    getJobApplications(),
    getNetworkSources(),
  ]);

  return (
    <div>
      <PageTitle>Career</PageTitle>
      <p className="-mt-2 mb-5 text-[14px] text-muted">
        Work out what you want to do, go after it, and keep track of who can
        help. 👇
      </p>
      <CareerClient
        initialPaths={paths}
        initialResumes={resumes}
        initialApplications={applications}
        initialSources={sources}
      />
    </div>
  );
}
