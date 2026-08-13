import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import BusinessFinancesClient from "@/components/BusinessFinancesClient";
import { pageGate } from "@/lib/visibility";
import { businessFinancesReady, getBusinessFinances } from "@/lib/businessFinances";

export const dynamic = "force-dynamic";

export default async function BusinessFinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { comingSoon } = await pageGate("business-finances");
  if (comingSoon) return <ComingSoon title="Business Finances" />;

  const sp = await searchParams;
  const asked = parseInt(sp.year ?? "", 10);
  const { data, error } = await getBusinessFinances(
    Number.isFinite(asked) ? asked : undefined,
  );

  if (!data) {
    return (
      <div>
        <PageTitle>Business Finances</PageTitle>
        <Card>
          <p className="text-[15px] font-medium">Nothing to show yet</p>
          <p className="mt-1 text-[14px] text-muted">{error}</p>
          {!businessFinancesReady() && (
            <p className="mt-3 text-xs text-muted">
              Setup note: add <code>MONEYAPP_SHARED_EMAIL</code> in Vercel — the
              address on the Money App&apos;s Shared access list for this app —
              alongside the <code>MONEYAPP_API_URL</code> and{" "}
              <code>MONEYAPP_API_KEY</code> the debt sync already uses.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Business Finances</PageTitle>
      <BusinessFinancesClient data={data} />
    </div>
  );
}
