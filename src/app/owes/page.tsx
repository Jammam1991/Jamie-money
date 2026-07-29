import { PageTitle } from "@/components/ui";
import OwesChrisClient from "@/components/OwesChrisClient";
import { getCashLog, getOwesCharges } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OwesPage() {
  const [charges, cashLog, admin] = await Promise.all([
    getOwesCharges(),
    getCashLog(),
    isAdmin(),
  ]);

  // Every "Gave cash to Chris" tap on the home screen counts against what
  // Jamie owes here — same numbers on both pages.
  const givenEntries = cashLog.filter((e) => e.kind === "to_chris");

  return (
    <div>
      <PageTitle>What I Owe Chris</PageTitle>
      <OwesChrisClient
        initialCharges={charges}
        givenEntries={givenEntries}
        admin={admin}
      />
    </div>
  );
}
