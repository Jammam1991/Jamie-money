"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { unhideMoneyAppDebts } from "@/lib/actions";

// Pulls Jamie's debts + credit score from Money App. Admin-only — the parent
// only renders this for a logged-in Chris.
export default function MoneyAppConnect() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [hidden, setHidden] = useState(0);

  // Undo for a delete that shouldn't have happened. Nothing else can bring a
  // hidden account back, so without this one mis-click loses it for good.
  async function unhide() {
    setBusy(true);
    const result = await unhideMoneyAppDebts();
    setBusy(false);
    if (!result.ok) {
      setNote(result.error ?? "Couldn't bring them back.");
      return;
    }
    setHidden(0);
    setNote("Brought back — syncing again will fill them in.");
    router.refresh();
  }

  async function sync() {
    setBusy(true);
    setNote(null);
    setProblems([]);
    try {
      const res = await fetch("/api/moneyapp/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't sync.");

      // "Synced 0" on its own is the least useful thing this button can say —
      // it's the same message whether Money App has nothing filed under Jamie
      // or it sent a dozen accounts and not one of them could be saved. Say
      // which.
      const received = Number(data.received ?? data.synced ?? 0);
      const synced = Number(data.synced ?? 0);
      const loans = Number(data.loans ?? 0);
      const loanNote =
        loans > 0 ? ` Plus ${loans} private loan${loans === 1 ? "" : "s"}.` : "";
      // Accounts left out because they were deleted here — Chris's own, which
      // Money App sends along with Jamie's. Saying so is the difference between
      // "the sync is working" and "the sync is missing things".
      const hiddenCount = Number(data.hidden ?? 0);
      setHidden(hiddenCount);
      const hiddenNote =
        hiddenCount > 0
          ? ` ${hiddenCount} account${hiddenCount === 1 ? "" : "s"} left out — deleted here, so not Jamie's.`
          : "";
      setNote(
        (received === 0
          ? "Money App has no open debts filed under Jamie."
          : `Money App sent ${received} account${received === 1 ? "" : "s"} — ` +
            `saved ${synced}.`) +
          loanNote +
          hiddenNote,
      );
      setProblems(
        data.database
          ? [
              ...(data.problems ?? []),
              `This app writes to ${data.database} — make sure that's the project the SQL was run in.`,
            ]
          : (data.problems ?? []),
      );
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium disabled:opacity-50"
        onClick={sync}
        disabled={busy}
      >
        <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
        Sync from Money App
      </button>
      {note && <p className="mt-2 text-center text-xs text-muted">{note}</p>}
      {hidden > 0 && (
        <button
          className="mt-1 w-full text-center text-xs text-muted underline disabled:opacity-50"
          onClick={unhide}
          disabled={busy}
        >
          Bring the left-out accounts back
        </button>
      )}
      {problems.map((p) => (
        <p key={p} className="mt-1 text-center text-xs text-warn">
          {p}
        </p>
      ))}
    </div>
  );
}
