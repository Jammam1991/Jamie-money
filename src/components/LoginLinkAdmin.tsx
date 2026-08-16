"use client";

import { useState, useTransition } from "react";
import { Mail, Link2, Check } from "lucide-react";
import { Card } from "@/components/ui";
import { copyJamieLoginLink, sendJamieLoginLink } from "@/lib/actions";

// "Get Jamie in", one section on Settings.
//
// Jamie's password lives in Vercel, so he can't reset it and Chris can't look
// it up from a phone. Rather than email a password that would then sit in his
// inbox forever, both buttons here hand out a link that expires.
export default function LoginLinkAdmin({
  minutes,
  configured,
  sendsTo,
}: {
  minutes: number;
  configured: boolean;
  sendsTo: string[];
}) {
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    setNote(null);
    setLink(null);
    startTransition(async () => {
      const res = await sendJamieLoginLink();
      if (!res.ok) {
        setError(res.error ?? "Couldn't send it.");
        return;
      }
      setNote(`Sent to ${res.sentTo?.join(", ")}. It works for ${minutes} minutes.`);
    });
  }

  function copy() {
    setError(null);
    setNote(null);
    setLink(null);
    startTransition(async () => {
      const res = await copyJamieLoginLink();
      if (!res.ok || !res.url) {
        setError(res.error ?? "Couldn't make one.");
        return;
      }
      // Clipboard access can be refused — on an insecure origin, or if the
      // browser just says no. Showing the link is the fallback, so Chris can
      // still select it by hand rather than hitting a dead end.
      try {
        await navigator.clipboard.writeText(res.url);
        setNote(`Copied. Paste it to Jamie — it works for ${minutes} minutes.`);
      } catch {
        setNote(`Copy this — it works for ${minutes} minutes.`);
      }
      setLink(res.url);
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[13px] font-medium text-muted">Get Jamie in</h2>
      <p className="-mt-2 text-[13px] text-muted">
        Sends Jamie a link that logs him straight in — no password to remember.
        The link stops working after {`${minutes} minutes`}, but once he&apos;s
        in he stays signed in for 30 days.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</div>
      )}

      <Card className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={send}
            disabled={pending || !configured}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--good)" }}
          >
            <Mail size={15} />
            {pending ? "Working…" : "Email Jamie a login link"}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={pending || !configured}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[14px] font-medium disabled:opacity-50"
          >
            <Link2 size={15} />
            Copy a link instead
          </button>
        </div>

        {!configured && (
          <p className="text-[13px] text-muted">
            Add <code>ADMIN_PASSWORD</code> and <code>JAMIE_PASSWORD</code> in
            Vercel, then redeploy, and these switch on.
          </p>
        )}

        {configured && sendsTo.length > 0 && (
          <p className="text-[13px] text-muted">
            Email goes to {sendsTo.join(", ")}.
          </p>
        )}

        {configured && sendsTo.length === 0 && (
          <p className="text-[13px] text-muted">
            No address set yet — add <code>JAMIE_EMAIL</code> in Vercel to use
            the email button. Copying the link works either way.
          </p>
        )}

        {note && (
          <p className="flex items-start gap-1.5 text-[13px]" style={{ color: "var(--good)" }}>
            <Check size={15} className="mt-0.5 shrink-0" />
            <span>{note}</span>
          </p>
        )}

        {link && (
          <p className="break-all rounded-lg bg-tint p-2 font-mono text-[12px]">{link}</p>
        )}
      </Card>
    </div>
  );
}
