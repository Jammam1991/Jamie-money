"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Landmark, RefreshCw } from "lucide-react";

// Plaid's Link popup, loaded from their CDN on demand.
const LINK_SRC = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

type PlaidHandler = { open: () => void; exit: () => void };
type PlaidLink = {
  create: (opts: {
    token: string;
    onSuccess: (publicToken: string, metadata: { institution?: { name?: string } }) => void;
    onExit: (err: unknown) => void;
  }) => PlaidHandler;
};
declare global {
  interface Window {
    Plaid?: PlaidLink;
  }
}

function loadPlaid(): Promise<PlaidLink> {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve(window.Plaid);
    const s = document.createElement("script");
    s.src = LINK_SRC;
    s.onload = () => (window.Plaid ? resolve(window.Plaid) : reject(new Error("Plaid failed to load")));
    s.onerror = () => reject(new Error("Plaid failed to load"));
    document.head.appendChild(s);
  });
}

// Shows "Connect your bank" (first time) or "Refresh from bank" (already linked).
// Both are admin-only — the parent only renders this for a logged-in Chris.
export default function PlaidConnect({ hasBank }: { hasBank: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start.");

      const Plaid = await loadPlaid();
      const handler = Plaid.create({
        token: data.link_token,
        onSuccess: async (publicToken, metadata) => {
          setBusy(true);
          setNote("Pulling your debts…");
          try {
            const ex = await fetch("/api/plaid/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_token: publicToken,
                institution_name: metadata.institution?.name ?? null,
              }),
            });
            const exData = await ex.json();
            if (!ex.ok) throw new Error(exData.error ?? "Couldn't finish.");
            setNote(
              exData.synced > 0
                ? `Added ${exData.synced} from your bank.`
                : "Connected — no debts found on that bank.",
            );
            router.refresh();
          } catch (e) {
            setNote(e instanceof Error ? e.message : "Something went wrong.");
          } finally {
            setBusy(false);
          }
        },
        onExit: () => setBusy(false),
      });
      handler.open();
      setBusy(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't refresh.");
      setNote(`Updated ${data.synced} from your bank.`);
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium disabled:opacity-50"
          onClick={connect}
          disabled={busy}
        >
          <Landmark size={17} />
          {hasBank ? "Connect another bank" : "Connect your bank"}
        </button>
        {hasBank && (
          <button
            aria-label="Refresh from bank"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium disabled:opacity-50"
            onClick={refresh}
            disabled={busy}
          >
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
          </button>
        )}
      </div>
      {note && <p className="mt-2 text-center text-xs text-muted">{note}</p>}
    </div>
  );
}
