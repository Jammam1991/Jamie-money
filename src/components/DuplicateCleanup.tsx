"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eraser } from "lucide-react";
import { money } from "@/lib/data";
import { deleteManualDebts, listCleanupCandidates } from "@/lib/actions";
import type { CleanupCandidate } from "@/lib/duplicateDebts";

// Removes the debts typed in by hand that Money App has since taken over.
//
// Nothing goes without being shown first: the list opens with the likely
// duplicates already ticked and everything else left alone, and the button
// says how many rows and how much balance are about to disappear. Admin-only —
// the parent only renders this for a logged-in Chris.
export default function DuplicateCleanup() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CleanupCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setNote(null);
    const res = await listCleanupCandidates();
    setBusy(false);
    if (!res.ok || !res.candidates) {
      setNote(res.error ?? "Couldn't read the debt list.");
      return;
    }
    setRows(res.candidates);
    // Pre-tick the ones that matched a synced account. The rest are listed but
    // untouched — a row we couldn't match is more likely a real debt than a
    // duplicate.
    setPicked(new Set(res.candidates.filter((r) => r.matches).map((r) => r.id)));
    setOpen(true);
  }

  async function remove() {
    setBusy(true);
    const res = await deleteManualDebts([...picked]);
    setBusy(false);
    if (!res.ok) {
      setNote(res.error ?? "Couldn't delete those.");
      return;
    }
    setNote(`Removed ${picked.size} row${picked.size === 1 ? "" : "s"}.`);
    setOpen(false);
    setRows(null);
    router.refresh();
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!open) {
    return (
      <div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium disabled:opacity-50"
          onClick={load}
          disabled={busy}
        >
          <Eraser size={16} />
          {busy ? "Looking…" : "Clean up duplicates"}
        </button>
        {note && <p className="mt-2 text-center text-xs text-muted">{note}</p>}
      </div>
    );
  }

  const chosen = (rows ?? []).filter((r) => picked.has(r.id));
  const freed = chosen.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium">Hand-entered debts</p>
      <p className="mt-1 text-xs text-muted">
        These weren&apos;t sent by Money App. The ones it looks to have taken over
        are ticked — untick anything you want to keep.
      </p>

      {rows?.length === 0 && (
        <p className="mt-3 text-xs text-muted">
          Nothing to clean up — every debt on the page came from Money App.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {rows?.map((r) => (
          <label key={r.id} className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={picked.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <span className="flex-1">
              <span className="flex items-center justify-between gap-2">
                <span>{r.name}</span>
                <span className="text-muted">{money(r.balance)}</span>
              </span>
              <span className="block text-xs text-muted">
                {r.matches ? `Looks like ${r.matches}` : "No match in Money App"}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          className="flex-1 rounded-xl border border-border py-2 text-sm"
          onClick={() => {
            setOpen(false);
            setRows(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="flex-1 rounded-xl bg-warn py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={remove}
          disabled={busy || picked.size === 0}
        >
          {busy
            ? "Removing…"
            : `Remove ${picked.size} (${money(freed)})`}
        </button>
      </div>
      {note && <p className="mt-2 text-center text-xs text-warn">{note}</p>}
    </div>
  );
}
