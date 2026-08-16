import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import HouseholdIncomeAdmin from "@/components/HouseholdIncomeAdmin";
import TaxDocumentsAdmin from "@/components/TaxDocumentsAdmin";
import PasswordsAdmin from "@/components/PasswordsAdmin";
import { getRole, isVaultUnlocked, VAULT_MINUTES } from "@/lib/auth";
import {
  getComingSoonPages,
  getHouseholdIncome,
  getPageSlots,
  getRemovedPages,
} from "@/lib/store";
import { getTaxDocuments } from "@/lib/taxCenter";
import { getPasswordEntries, vaultConfigured } from "@/lib/passwords";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/login");

  const vaultOpen = await isVaultUnlocked();

  const [comingSoon, removed, placements, taxDocuments, householdIncome, passwords] =
    await Promise.all([
      getComingSoonPages(),
      getRemovedPages(),
      getPageSlots(),
      getTaxDocuments(),
      getHouseholdIncome(),
      // Labels only, and only once the password book's own lock is open.
      vaultOpen ? getPasswordEntries() : Promise.resolve([]),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <PageTitle>Settings</PageTitle>
        <SettingsClient
          initialComingSoon={comingSoon}
          initialRemoved={removed}
          initialPlacements={placements}
        />
      </div>
      {/* The deferred-debts switches are hidden for now. The Debt page no
          longer shows a "paying now, without deferred" figure, so a toggle
          here would change nothing on screen. The component, the actions and
          the stored ids are all still in place — put this back and it works
          again the moment that card returns. */}
      <HouseholdIncomeAdmin initial={householdIncome} />
      <TaxDocumentsAdmin initialDocuments={taxDocuments} />
      <PasswordsAdmin
        initialEntries={passwords}
        unlocked={vaultOpen}
        configured={vaultConfigured()}
        minutes={VAULT_MINUTES}
      />
    </div>
  );
}
