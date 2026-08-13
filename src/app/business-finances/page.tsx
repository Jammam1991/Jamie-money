import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import BusinessFinancesClient from "@/components/BusinessFinancesClient";
import { pageGate } from "@/lib/visibility";
import { businessFinancesReady, getBusinessFinances } from "@/lib/businessFinances";

export const dynamic = "force-dynamic";

export default async function BusinessFinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { comingSoon } = await pageGate("business-finances");
  if (comingSoon) return <ComingSoon title="Business Finances" />;

  const sp = await searchParams;
  const yearStr = sp.year ?? "";
  const monthStr = sp.month ?? "";

  // Handle "all-time" special case
  const isAllTime = yearStr === "all-time";
  const year = isAllTime ? undefined : (Number.isFinite(parseInt(yearStr, 10)) ? parseInt(yearStr, 10) : undefined);
  const month = Number.isFinite(parseInt(monthStr, 10)) ? parseInt(monthStr, 10) : undefined;

  const { data, error } = await getBusinessFinances(year, month, isAllTime);

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
