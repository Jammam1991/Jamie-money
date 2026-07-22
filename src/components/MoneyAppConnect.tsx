"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

// Pulls Jamie's debts + credit score from Money App. Admin-only — the parent
// only renders this for a logged-in Chris.
export default function MoneyAppConnect() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/moneyapp/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't sync.");
      setNote(`Synced ${data.synced} from Money App.`);
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
    </div>
  );
}
