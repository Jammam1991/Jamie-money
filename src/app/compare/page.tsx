import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import CompareClient from "@/components/CompareClient";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const role = await getRole();
  if (!role) redirect("/login");
  return (
    <div>
      <PageTitle>Job vs Business</PageTitle>
      <CompareClient />
    </div>
  );
}
