import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import OverallDebtClient from "@/components/OverallDebtClient";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OverallDebtPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  return (
    <div>
      <PageTitle>Overall Debt</PageTitle>
      <OverallDebtClient />
    </div>
  );
}
