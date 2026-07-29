"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// The git SHA baked into THIS bundle at compile time (see next.config.ts). When
// /api/version (served by the latest deployment) reports a different SHA, a
// newer version is live and this loaded page is stale.
const OWN_SHA = process.env.GIT_SHA ?? "local";
const IS_DEV = OWN_SHA === "local";

const POLL_MS = 60_000;

// Banner shown when a newer deploy has gone live. Polls /api/version to
// detect it without a reload; clicking it does a hard refresh onto the new
// build.
export default function UpdateNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (IS_DEV) return; // no deploys to detect while iterating locally

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { sha?: string };
        if (!cancelled && data.sha && data.sha !== OWN_SHA) {
          setShow(true);
        }
      } catch {
        // network blip — try again on the next tick
      }
    }

    check();
    const timer = setInterval(check, POLL_MS);
    // Re-check the moment the user returns to the tab, so a stale tab left
    // open surfaces the banner immediately instead of up to a minute later.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function hardRefresh() {
    // Best-effort: drop any cached app shell so the reload pulls the new
    // build's assets rather than a stale cached chunk.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore — a plain reload still gets fresh (content-hashed) assets
    }
    window.location.reload();
  }

  if (!show) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={hardRefresh}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-good/40 bg-good-bg px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-good/20 text-good">
            <RefreshCw size={14} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-text">
              New update available
            </div>
            <div className="hidden sm:block text-xs text-muted mt-0.5">
              Click to refresh and load the latest version.
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-good px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-semibold text-white">
          Refresh now →
        </span>
      </button>
    </div>
  );
}
