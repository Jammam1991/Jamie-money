import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import JobVsBusinessClient from "@/components/JobVsBusinessClient";
import {
  getJobVsBusiness,
  getProsCons,
  getJobPostings,
  getDecisionJournal,
} from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function JobVsBusinessPage() {
  const role = await getRole();
  if (!role) redirect("/login");

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
