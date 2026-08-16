import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import BusinessFinancesClient from "@/components/BusinessFinancesClient";
import { pageGate } from "@/lib/visibility";
import { businessFinancesReady, getBusinessFinances } from "@/lib/businessFinances";
import { modeById, readViewMode } from "@/lib/businessViewModes";
import { earnedPayForPeriod, getJamiePayMonths } from "@/lib/gymPay";

export const dynamic = "force-dynamic";

export default async function BusinessFinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; view?: string; operational?: string }>;
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
  // Which of the five cuts to ask Money App for. The mode carries the switches
  // so the page never has to reason about `operational` and `trim` separately
  // — and so "which numbers am I looking at?" has one answer, not two.
  const modeId = readViewMode(sp);
  const mode = modeById(modeId);

  // Fetched alongside Money App rather than after it — the two have nothing
  // to do with each other, so there's no reason to pay for them one at a
  // time. The gym dashboard's answer isn't year-scoped, so it's narrowed
  // below once Money App has said which year it actually loaded.
  const [{ data, error }, payMonths] = await Promise.all([
    getBusinessFinances(year, month, isAllTime, mode.operational, mode.slim, mode.noFed),
    getJamiePayMonths(),
  ]);

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

  // `data.year`, not the `year` parsed off the URL — with no `?year=` at all
  // (the plain /business-finances load) that param is undefined while Money
  // App has quietly resolved to the current year. Narrowing on the URL's
  // silence matched no month and handed the toggle a $0 to subtract.
  const jamiePay = earnedPayForPeriod(payMonths, data.year, data.month);

  return (
    <div>
      <PageTitle>Business Finances</PageTitle>
      <BusinessFinancesClient data={data} modeId={modeId} jamiePay={jamiePay} />
    </div>
  );
}
