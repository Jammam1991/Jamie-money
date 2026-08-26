"use client";

import { useState } from "react";
import { Check, KeyRound, Link2, Mail, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui";
import { copyJamieLoginLink, sendJamieLoginLink, setJamiePin } from "@/lib/actions";

// "Get Jamie in", one section on Settings.
//
// The plan is deliberately dull: Chris picks four digits, texts Jamie the link
// and the digits, and that's the last time either of them thinks about it.
// Nothing here expires — not the link, not the PIN, not the session it opens.
//
// The PIN is stored one-way, so this screen can't show Chris what it currently
// is. That's why the "message for Jamie" button only appears right after he
// sets one: at that moment the digits are on screen anyway. Forgotten later
// means setting a new one, which takes about five seconds.
export default function JamieAccessAdmin({
  pinSet,
  pinLength,
  appUrl,
  minutes,
  linkConfigured,
  sendsTo,
}: {
  pinSet: boolean;
  pinLength: number;
  appUrl: string;
  minutes: number;
  linkConfigured: boolean;
  sendsTo: string[];
}) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSet, setJustSet] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Hang on to the digits once the save comes back clean — they're what the
  // "message for Jamie" button needs, and they're gone as soon as he leaves
  // the page, because nothing stores them.
  async function savePin() {
    setSaving(true);
    const res = await setJamiePin(pin);
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error ?? "Couldn't save it.");
      return;
    }
    setSaveError(null);
    setJustSet(pin);
    setPin("");
  }

  const message = justSet
    ? `Here's your money app: ${appUrl}\n\nYour PIN is ${justSet}. Add it to your home screen and it opens like a normal app — it won't ask you again.`
    : null;

  async function copy(text: string, ok: string) {
    setError(null);
    setNote(null);
    setLink(null);
    try {
      await navigator.clipboard.writeText(text);
      setNote(ok);
    } catch {
      // Clipboard access can be refused. Showing the text is the fallback, so
      // it can still be selected by hand rather than hitting a dead end.
      setNote("Copy this:");
      setLink(text);
    }
  }

  async function emailLink() {
    setError(null);
    setNote(null);
    setLink(null);
    setBusy(true);
    const res = await sendJamieLoginLink();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send it.");
      return;
    }
    setNote(`Sent to ${res.sentTo?.join(", ")}. That link works for ${minutes} minutes.`);
  }

  async function copyLink() {
    setError(null);
    setNote(null);
    setLink(null);
    setBusy(true);
    const res = await copyJamieLoginLink();
    setBusy(false);
    if (!res.ok || !res.url) {
      setError(res.error ?? "Couldn't make one.");
      return;
    }
    await copy(res.url, `Copied. That link works for ${minutes} minutes.`);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[13px] font-medium text-muted">Get Jamie in</h2>
      <p className="-mt-2 text-[13px] text-muted">
        Send him the link and a {pinLength}-digit PIN. He taps it in once and
        stays logged in — nothing expires.
      </p>

      {error && <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</div>}

      <Card className="space-y-3">
        <div className="space-y-2">
          <label className="block text-[13px] font-medium" htmlFor="pin">
            {pinSet ? "Change Jamie's PIN" : "Set Jamie's PIN"}
          </label>
          <div className="flex gap-2">
            <input
              id="pin"
              name="pin"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, pinLength))
              }
              inputMode="numeric"
              autoComplete="off"
              placeholder={"•".repeat(pinLength)}
              className="w-28 rounded-lg border border-border bg-card px-3 py-2.5 text-center text-[17px] tracking-[0.4em] tabular-nums outline-none focus:border-[var(--muted)]"
            />
            <button
              type="button"
              onClick={savePin}
              disabled={saving || pin.length !== pinLength}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--good)" }}
            >
              <KeyRound size={15} />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {saveError && <p className="text-[13px] text-warn">{saveError}</p>}
          <p className="text-[13px] text-muted">
            {pinSet
              ? "A PIN is set. Setting a new one replaces it straight away."
              : "No PIN yet, so Jamie can't get in."}{" "}
            You can&apos;t look it up again afterwards — if he forgets it, set a
            new one.
          </p>
        </div>

        {message && (
          <button
            type="button"
            onClick={() => copy(message, "Copied. Paste it into a text to Jamie.")}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[14px] font-medium"
          >
            <MessageSquare size={15} />
            Copy the message for Jamie
          </button>
        )}
      </Card>

      <Card className="space-y-2">
        <p className="text-[13px] font-medium">Or skip the PIN this once</p>
        <p className="text-[13px] text-muted">
          A one-tap link that logs him straight in. Handy the very first time.
          It stops working after {minutes} minutes — his PIN doesn&apos;t.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={emailLink}
            disabled={busy || !linkConfigured}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[14px] font-medium disabled:opacity-50"
          >
            <Mail size={15} />
            {busy ? "Working…" : "Email him a link"}
          </button>
          <button
            type="button"
            onClick={copyLink}
            disabled={busy || !linkConfigured}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[14px] font-medium disabled:opacity-50"
          >
            <Link2 size={15} />
            Copy a link instead
          </button>
        </div>

        {!linkConfigured && (
          <p className="text-[13px] text-muted">
            Add <code>ADMIN_PASSWORD</code> in Vercel, then redeploy, and these
            switch on.
          </p>
        )}

        {linkConfigured && sendsTo.length === 0 && (
          <p className="text-[13px] text-muted">
            No address set yet — add <code>JAMIE_EMAIL</code> in Vercel to use
            the email button. Copying works either way.
          </p>
        )}

        {linkConfigured && sendsTo.length > 0 && (
          <p className="text-[13px] text-muted">Email goes to {sendsTo.join(", ")}.</p>
        )}
      </Card>

      {note && (
        <p className="flex items-start gap-1.5 text-[13px]" style={{ color: "var(--good)" }}>
          <Check size={15} className="mt-0.5 shrink-0" />
          <span>{note}</span>
        </p>
      )}

      {link && (
        <p className="whitespace-pre-wrap break-all rounded-lg bg-tint p-2 font-mono text-[12px]">
          {link}
        </p>
      )}
    </div>
  );
}
