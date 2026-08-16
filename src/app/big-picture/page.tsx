import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import BigPictureClient from "@/components/BigPictureClient";
import { pageGate } from "@/lib/visibility";
import { moneyAppReady } from "@/lib/moneyapp";
import { getHouseholdPicture } from "@/lib/householdPicture";
import { getDebts, getDebtSnapshotRows } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BigPicturePage() {
  const { role, comingSoon } = await pageGate("big-picture");
  if (comingSoon) return <ComingSoon title="The Big Picture" />;

  const [{ picture, error }, debts, debtSnapshots] = await Promise.all([
    getHouseholdPicture(),
    getDebts(),
    getDebtSnapshotRows(),
  ]);

  if (!picture) {
    return (
      <div>
        <PageTitle>Big Picture Debt Management</PageTitle>
        <Card>
          <p className="text-[15px] font-medium">Nothing to show yet</p>
          <p className="mt-1 text-[14px] text-muted">{error}</p>
          {!moneyAppReady() && (
            <p className="mt-3 text-xs text-muted">
              Setup note: this page reads the whole household&apos;s debt from the
              Money App — add <code>MONEYAPP_API_URL</code> and{" "}
              <code>MONEYAPP_API_KEY</code> in Vercel if they aren&apos;t set yet.
              The gym&apos;s profit needs <code>MONEYAPP_SHARED_EMAIL</code> too,
              same as Business Finances.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <BigPictureClient
        picture={picture}
        admin={role === "admin"}
        debts={debts}
        debtSnapshots={debtSnapshots}
      />
    </div>
  );
}
