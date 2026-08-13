"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { addTaxDocument, deleteTaxDocument } from "@/lib/actions";
import type { TaxDocument } from "@/lib/taxCenter";

// The Google Drive links to redacted tax returns, one section on Settings.
// The tax numbers themselves come live from the Money App — this is the only
// tax data this app actually stores, so it gets its own small CRUD here.
export default function TaxDocumentsAdmin({
  initialDocuments,
}: {
  initialDocuments: TaxDocument[];
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const y = parseInt(year, 10);
    if (!Number.isFinite(y)) {
      setError("Give it a year.");
      return;
    }
    if (!url.trim()) {
      setError("Paste the Google Drive link.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addTaxDocument({ year: y, driveUrl: url.trim(), label: label.trim() || undefined });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save that.");
        return;
      }
      setDocs((prev) =>
        [...prev, { id: res.id!, taxYear: y, driveUrl: url.trim(), label: label.trim() || null }].sort(
          (a, b) => b.taxYear - a.taxYear
        )
      );
      setUrl("");
      setLabel("");
    });
  }

  function remove(id: string) {
    const before = docs;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setError(null);
    startTransition(async () => {
      const res = await deleteTaxDocument(id);
      if (!res.ok) {
        setDocs(before);
        setError(res.error ?? "Couldn't delete that.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[13px] font-medium text-muted">Tax return documents</h2>
      <p className="-mt-2 text-[13px] text-muted">
        Google Drive links to redacted tax returns, by year. These show up on
        the Tax Center page.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</div>
      )}

      <Card className="space-y-2">
        {docs.length === 0 ? (
          <p className="text-[14px] text-muted">No links added yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{d.taxYear}</div>
                  <a
                    href={d.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-[13px] text-blue-600 hover:underline"
                  >
                    {d.label || d.driveUrl}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  disabled={pending}
                  className="shrink-0 text-[13px] font-medium text-muted hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <div className="flex gap-2">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year"
            className="w-24 rounded-lg border border-border bg-card px-2 py-1.5 text-[14px]"
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[14px]"
          />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[14px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="w-full rounded-lg py-2 text-[14px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--good)" }}
        >
          {pending ? "Saving…" : "Add link"}
        </button>
      </Card>
    </div>
  );
}
