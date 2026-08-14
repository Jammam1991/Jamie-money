"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Shuffle, Plus } from "lucide-react";
import { Card } from "@/components/ui";
import VaultUnlock from "@/components/VaultUnlock";
import {
  addPasswordEntry,
  deletePasswordEntry,
  revealPassword,
  updatePasswordEntry,
} from "@/lib/actions";
import type { PasswordEntry } from "@/lib/passwords";

// Where Chris types the logins in. Jamie reads them on /passwords and can't
// change anything — every write below is refused on the server for his
// password, not just hidden from his screen.

interface Draft {
  label: string;
  category: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

const EMPTY: Draft = { label: "", category: "", url: "", username: "", password: "", notes: "" };

// A made-up password: 20 characters from the browser's own randomness. The
// look-alikes (O/0, l/1) are left out so it can still be read off a screen.
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+";

function makePassword(): string {
  const bytes = new Uint32Array(20);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => ALPHABET[n % ALPHABET.length]).join("");
}

export default function PasswordsAdmin({
  initialEntries,
  unlocked,
  configured,
}: {
  initialEntries: PasswordEntry[];
  unlocked: boolean;
  configured: boolean;
}) {
  const [rows, setRows] = useState(initialEntries);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const heading = (
    <div>
      <h2 className="text-[13px] font-medium text-muted">Passwords</h2>
      <p className="mt-1 text-[13px] text-muted">
        The logins Jamie can look up from the <span className="font-medium">Passwords</span>{" "}
        link at the top of every screen. He can read them; only you can change them.
      </p>
    </div>
  );

  if (!configured) {
    return (
      <div className="space-y-3">
        {heading}
        <Card>
          <p className="text-[14px]">
            Add <code>PASSWORDS_KEY</code> in Vercel and redeploy to switch this on.
            It&apos;s the key that locks everything saved here, and it never goes
            into the database.
          </p>
        </Card>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="space-y-3">
        {heading}
        <VaultUnlock minutes={15} />
      </div>
    );
  }

  function add() {
    if (!draft.label.trim()) {
      setError("Give it a name, like \"Chase Bank\".");
      return;
    }
    if (!draft.password) {
      setError("There's no password to save.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addPasswordEntry({
        label: draft.label,
        url: draft.url,
        category: draft.category,
        username: draft.username,
        password: draft.password,
        notes: draft.notes,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save that.");
        return;
      }
      setRows((prev) =>
        [
          ...prev,
          {
            id: res.id!,
            label: draft.label.trim(),
            url: draft.url.trim() || null,
            category: draft.category.trim() || null,
            hasUsername: Boolean(draft.username),
            hasNotes: Boolean(draft.notes.trim()),
            updatedAt: null,
          },
        ].sort((a, b) => a.label.localeCompare(b.label))
      );
      setDraft(EMPTY);
      setAdding(false);
      setVisible(false);
    });
  }

  // Opening the editor fetches the entry's current username and notes so a
  // small change to the name can't quietly wipe them. The password itself is
  // left blank — typing one replaces it, leaving it alone keeps it.
  function startEdit(row: PasswordEntry) {
    setError(null);
    setEditingId(row.id);
    setEditDraft({
      label: row.label,
      category: row.category ?? "",
      url: row.url ?? "",
      username: "",
      password: "",
      notes: "",
    });
    startTransition(async () => {
      const res = await revealPassword(row.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditDraft((d) => ({ ...d, username: res.username, notes: res.notes }));
    });
  }

  function saveEdit(id: string) {
    if (!editDraft.label.trim()) {
      setError("Give it a name, like \"Chase Bank\".");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updatePasswordEntry(id, {
        label: editDraft.label,
        url: editDraft.url,
        category: editDraft.category,
        username: editDraft.username,
        password: editDraft.password || undefined,
        notes: editDraft.notes,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save that.");
        return;
      }
      setRows((prev) =>
        prev
          .map((r) =>
            r.id === id
              ? {
                  ...r,
                  label: editDraft.label.trim(),
                  url: editDraft.url.trim() || null,
                  category: editDraft.category.trim() || null,
                  hasUsername: Boolean(editDraft.username),
                  hasNotes: Boolean(editDraft.notes.trim()),
                }
              : r
          )
          .sort((a, b) => a.label.localeCompare(b.label))
      );
      setEditingId(null);
      setEditDraft(EMPTY);
    });
  }

  function remove(row: PasswordEntry) {
    if (!confirm(`Delete the saved login for "${row.label}"? This can't be undone.`)) return;
    const before = rows;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setError(null);
    startTransition(async () => {
      const res = await deletePasswordEntry(row.id);
      if (!res.ok) {
        setRows(before);
        setError(res.error ?? "Couldn't delete that.");
      }
    });
  }

  const field =
    "w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[14px] outline-none focus:border-[var(--muted)]";

  return (
    <div className="space-y-3">
      {heading}

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</div>
      )}

      <Card className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-[14px] text-muted">Nothing saved yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                {editingId === r.id ? (
                  <div className="space-y-2">
                    <input
                      className={field}
                      value={editDraft.label}
                      onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                      placeholder="Name"
                    />
                    <div className="flex gap-2">
                      <input
                        className={field}
                        value={editDraft.category}
                        onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                        placeholder="Folder (optional)"
                      />
                      <input
                        className={field}
                        value={editDraft.url}
                        onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                        placeholder="https://…"
                      />
                    </div>
                    <input
                      className={field}
                      value={editDraft.username}
                      onChange={(e) => setEditDraft({ ...editDraft, username: e.target.value })}
                      placeholder="Username"
                      autoComplete="off"
                    />
                    <input
                      className={field}
                      type="text"
                      value={editDraft.password}
                      onChange={(e) => setEditDraft({ ...editDraft, password: e.target.value })}
                      placeholder="New password — leave blank to keep the old one"
                      autoComplete="off"
                    />
                    <textarea
                      className={field}
                      rows={2}
                      value={editDraft.notes}
                      onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                      placeholder="Notes (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(r.id)}
                        disabled={pending}
                        className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
                        style={{ background: "var(--good)" }}
                      >
                        {pending ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-[13px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{r.label}</div>
                      <div className="truncate text-[12px] text-muted">
                        {[r.category, r.url].filter(Boolean).join(" · ") || "No folder"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        disabled={pending}
                        className="text-[13px] font-medium text-muted hover:text-[var(--text)] disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        disabled={pending}
                        className="text-[13px] font-medium text-muted hover:text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {adding ? (
        <Card className="space-y-2">
          <input
            className={field}
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Name — e.g. Chase Bank"
            autoFocus
          />
          <div className="flex gap-2">
            <input
              className={field}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Folder (optional)"
            />
            <input
              className={field}
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <input
            className={field}
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            placeholder="Username or email"
            autoComplete="off"
          />
          <div className="flex gap-2">
            <input
              className={field}
              type={visible ? "text" : "password"}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder="Password"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              className="shrink-0 rounded-lg border border-border px-2.5"
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft((d) => ({ ...d, password: makePassword() }));
                setVisible(true);
              }}
              title="Make one up"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-[13px]"
            >
              <Shuffle size={14} />
              Make one
            </button>
          </div>
          <textarea
            className={field}
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Notes (optional) — security questions, PIN, anything else"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--good)" }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY);
                setVisible(false);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-[13px]"
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium hover:bg-tint"
        >
          <Plus size={15} />
          Add a login
        </button>
      )}
    </div>
  );
}
