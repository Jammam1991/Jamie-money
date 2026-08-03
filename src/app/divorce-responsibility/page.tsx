import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import DivorceResponsibilityClient from "@/components/DivorceResponsibilityClient";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DivorceResponsibilityPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  return (
    <div>
      <PageTitle>Divorce Responsibility</PageTitle>
      <DivorceResponsibilityClient />
    </div>
  );
}
