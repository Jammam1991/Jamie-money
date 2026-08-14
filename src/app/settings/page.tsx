import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import HouseholdIncomeAdmin from "@/components/HouseholdIncomeAdmin";
import TaxDocumentsAdmin from "@/components/TaxDocumentsAdmin";
import { getRole } from "@/lib/auth";
import { getComingSoonPages, getHouseholdIncome } from "@/lib/store";
import { getTaxDocuments } from "@/lib/taxCenter";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/login");

  const [comingSoon, taxDocuments, householdIncome] = await Promise.all([
    getComingSoonPages(),
    getTaxDocuments(),
    getHouseholdIncome(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <PageTitle>Settings</PageTitle>
        <SettingsClient initialComingSoon={comingSoon} />
      </div>
      <HouseholdIncomeAdmin initial={householdIncome} />
      <TaxDocumentsAdmin initialDocuments={taxDocuments} />
    </div>
  );
}
