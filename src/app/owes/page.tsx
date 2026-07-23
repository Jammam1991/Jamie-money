import { PageTitle } from "@/components/ui";
import OwesChrisClient from "@/components/OwesChrisClient";
import { getOwesCharges } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OwesPage() {
  const [charges, admin] = await Promise.all([
    getOwesCharges(),
    isAdmin(),
  ]);

  return (
    <div>
      <PageTitle>Short-Term Debt</PageTitle>
      <OwesChrisClient initialCharges={charges} admin={admin} />
    </div>
  );
}
