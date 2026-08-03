import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import OwesChrisClient from "@/components/OwesChrisClient";
import { getCashLog, getOwesCharges } from "@/lib/store";
import { getRole, isViewingAsJamie } from "@/lib/auth";
import { monthStart } from "@/lib/pastDue";

export const dynamic = "force-dynamic";

export default async function OwesPage() {
  const role = await getRole();
  if (!role) redirect("/login");
  // "View as Jamie" hides the editing tools too, so Chris sees exactly the
  // read-only page Jamie gets.
  const viewingAsJamie = await isViewingAsJamie();
  const [charges, cashLog] = await Promise.all([getOwesCharges(), getCashLog()]);

  // Every "Gave cash to Chris" tap on the home screen counts against what
  // Jamie owes here — same numbers on both pages.
  const givenEntries = cashLog.filter((e) => e.kind === "to_chris");

  return (
    <div>
      <PageTitle>Past Due Balance</PageTitle>
      <OwesChrisClient
        initialCharges={charges}
        givenEntries={givenEntries}
        admin={role === "admin" && !viewingAsJamie}
        monthStart={monthStart()}
      />
    </div>
  );
}
