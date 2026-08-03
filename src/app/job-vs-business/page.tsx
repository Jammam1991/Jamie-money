import { PageTitle } from "@/components/ui";
import JobVsBusinessClient from "@/components/JobVsBusinessClient";
import {
  getJobVsBusiness,
  getProsCons,
  getJobPostings,
  getDecisionJournal,
} from "@/lib/store";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function JobVsBusinessPage() {
  const { comingSoon } = await pageGate("job-vs-business");
  if (comingSoon) return <ComingSoon title="Job vs Business" />;

  const [comparison, prosCons, postings, journal] = await Promise.all([
    getJobVsBusiness(),
    getProsCons(),
    getJobPostings(),
    getDecisionJournal(),
  ]);

  return (
    <div>
      <PageTitle>Job vs Business</PageTitle>
      <p className="-mt-2 mb-5 text-[14px] text-muted">
        Two roads, same you. Here&apos;s how they stack up. 👇
      </p>
      <JobVsBusinessClient
        initialComparison={comparison}
        initialProsCons={prosCons}
        initialPostings={postings}
        initialJournal={journal}
      />
    </div>
  );
}
