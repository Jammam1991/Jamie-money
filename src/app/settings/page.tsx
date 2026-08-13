import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import TaxDocumentsAdmin from "@/components/TaxDocumentsAdmin";
import { getRole } from "@/lib/auth";
import { getComingSoonPages } from "@/lib/store";
import { getTaxDocuments } from "@/lib/taxCenter";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/login");

  const [comingSoon, taxDocuments] = await Promise.all([
    getComingSoonPages(),
    getTaxDocuments(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <PageTitle>Settings</PageTitle>
        <SettingsClient initialComingSoon={comingSoon} />
      </div>
      <TaxDocumentsAdmin initialDocuments={taxDocuments} />
    </div>
  );
}
