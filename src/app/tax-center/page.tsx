import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import { pageGate } from "@/lib/visibility";
import { getTaxDocuments, getTaxFilingResults, taxCenterReady } from "@/lib/taxCenter";

export const dynamic = "force-dynamic";

function fmtMoney(n: number | null) {
  if (n == null) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function TaxCenterPage() {
  const { comingSoon } = await pageGate("tax-center");
  if (comingSoon) return <ComingSoon title="Tax Center" />;

  const [{ results, error }, documents] = await Promise.all([
    getTaxFilingResults(),
    getTaxDocuments(),
  ]);

  const years = new Set<number>();
  results.forEach((r) => years.add(r.year));
  documents.forEach((d) => years.add(d.taxYear));
  const sortedYears = [...years].sort((a, b) => b - a);

  if (sortedYears.length === 0) {
    return (
      <div>
        <PageTitle>Tax Center</PageTitle>
        <Card>
          <p className="text-[15px] font-medium">Nothing to show yet</p>
          <p className="mt-1 text-[14px] text-muted">
            {error ?? "No tax years have been added yet."}
          </p>
          {!taxCenterReady() && (
            <p className="mt-3 text-xs text-muted">
              Setup note: add <code>MONEYAPP_API_URL</code> and{" "}
              <code>MONEYAPP_API_KEY</code> in Vercel — the same pair the debt
              sync uses.
            </p>
          )}
        </Card>
      </div>
    );
  }

  const resultByYear = new Map(results.map((r) => [r.year, r]));
  const docsByYear = new Map<number, typeof documents>();
  documents.forEach((d) => {
    docsByYear.set(d.taxYear, [...(docsByYear.get(d.taxYear) ?? []), d]);
  });

  return (
    <div>
      <PageTitle>Tax Center</PageTitle>
      <div className="space-y-3">
        {sortedYears.map((year) => {
          const r = resultByYear.get(year);
          const docs = docsByYear.get(year) ?? [];
          const paid = fmtMoney(r?.taxesPaid ?? null);
          const refund = fmtMoney(r?.refundAmount ?? null);
          return (
            <Card key={year}>
              <p className="text-[15px] font-medium">{year}</p>
              {(paid || refund) && (
                <p className="mt-1 text-[14px] text-muted">
                  {paid && <>Paid {paid}</>}
                  {paid && refund && " · "}
                  {refund && <>Refund {refund}</>}
                </p>
              )}
              {r?.refundUsedFor && (
                <p className="mt-1 text-[13px] text-faint">Used for: {r.refundUsedFor}</p>
              )}
              {docs.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {docs.map((d) => (
                    <a
                      key={d.id}
                      href={d.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[14px] font-medium text-blue-600 hover:underline"
                    >
                      {d.label || "Tax return document"} →
                    </a>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
