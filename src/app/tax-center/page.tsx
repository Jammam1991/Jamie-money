import Link from "next/link";
import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import { TaxYearStory } from "@/components/TaxYearStory";
import { pageGate } from "@/lib/visibility";
import { getTaxDocuments, getTaxFilingResults, taxCenterReady } from "@/lib/taxCenter";

export const dynamic = "force-dynamic";

export default async function TaxCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
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

  // One year at a time, newest first. A whole year of tax is a lot to take in
  // — stacking every year on one screen buried the story that each one tells.
  const sp = await searchParams;
  const asked = Number(sp.year);
  const year = sortedYears.includes(asked) ? asked : sortedYears[0];

  const result = results.find((r) => r.year === year) ?? null;
  const docs = documents.filter((d) => d.taxYear === year);

  return (
    <div>
      <PageTitle>Tax Center</PageTitle>

      {sortedYears.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {sortedYears.map((y) => (
            <Link
              key={y}
              href={`/tax-center?year=${y}`}
              scroll={false}
              className="rounded-lg border border-border px-3 py-1 text-[13px]"
              style={
                y === year
                  ? { background: "var(--good)", color: "#fff", borderColor: "var(--good)" }
                  : undefined
              }
            >
              {y}
            </Link>
          ))}
        </div>
      )}

      {result ? (
        <TaxYearStory result={result} />
      ) : (
        <Card>
          <p className="text-[14px] text-muted">
            No tax numbers are saved for {year} — just the documents below.
          </p>
        </Card>
      )}

      {docs.length > 0 && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-[15px] font-semibold">
            <span className="mr-1.5">📎</span>
            The paperwork
          </p>
          <div className="mt-2 space-y-1.5">
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
        </div>
      )}
    </div>
  );
}
