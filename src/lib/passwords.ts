import crypto from "node:crypto";
import { client } from "./store";

// ── The password book ─────────────────────────────────────────────────────────
// Chris types the logins in on Settings; Jamie can look them up. The rules the
// rest of this file exists to keep:
//
//   1. The username, password and notes are locked (encrypted) before they go
//      into the database, and only ever unlocked here on the server. The key is
//      an environment variable in Vercel — it is not in the database, so a copy
//      of the database on its own is useless.
//   2. A locked value is tied to the row and the field it belongs to. Moving a
//      scrambled password into a different row makes it refuse to open rather
//      than quietly hand back the wrong secret.
//   3. Nothing secret is ever sent to the browser by the page itself. The list
//      is labels only; a single secret comes over the wire when, and only when,
//      someone presses Show on that one row.

const SCRYPT_SALT = "jamie-money-vault-v1";

// Worked out once. Turning a passphrase into a key is deliberately slow, which
// is the point when someone is guessing and pure waste on every page load.
let cachedKey: Buffer | null = null;

function key(): Buffer | null {
  if (cachedKey) return cachedKey;
  const raw = process.env.PASSWORDS_KEY?.trim();
  if (!raw) return null;
  // 64 hex characters is already a full-strength key, so it's used as-is.
  // Anything else is treated as a passphrase and stretched into one.
  cachedKey = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.scryptSync(raw, SCRYPT_SALT, 32);
  return cachedKey;
}

export function vaultConfigured(): boolean {
  return Boolean(process.env.PASSWORDS_KEY?.trim());
}

// The stored shape: v1:<starter>:<seal>:<scrambled>. The seal is what makes
// this tamper-evident — change a single character of the scrambled text and it
// won't open at all.
export function seal(plain: string, aad: string): string {
  const k = key();
  if (!k) throw new Error("PASSWORDS_KEY isn't set.");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [
    "v1",
    iv.toString("base64"),
    c.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(":");
}

export function unseal(blob: string | null | undefined, aad: string): string {
  if (!blob) return "";
  const k = key();
  if (!k) throw new Error("PASSWORDS_KEY isn't set.");
  const [v, iv, tag, body] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("That entry looks damaged.");
  const d = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}

// What a locked value is tied to: this row, this field.
export function aad(id: string, field: "username" | "password" | "notes"): string {
  return `${id}|${field}`;
}

// One row of the list. Deliberately has no secret on it — this is the type the
// page renders and hands to the browser.
export interface PasswordEntry {
  id: string;
  label: string;
  url: string | null;
  category: string | null;
  hasUsername: boolean;
  hasNotes: boolean;
  updatedAt: string | null;
}

// The three locked fields, opened. Only ever built inside a server action that
// has already checked who's asking.
export interface PasswordSecret {
  username: string;
  password: string;
  notes: string;
}

// What the Show button gets back. Its own type rather than the app's usual
// ActionResult, because `ok` here has to be a yes-or-no the compiler can read:
// on the "no" branch there are no secrets to reach for.
export type RevealResult =
  | ({ ok: true } & PasswordSecret)
  | { ok: false; error: string };

export async function getPasswordEntries(): Promise<PasswordEntry[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("password_entries")
    .select("id,label,url,category,username_enc,notes_enc,updated_at")
    .order("sort", { ascending: true })
    .order("label", { ascending: true });
  // The table arrives with passwords.sql. Until that's run there's simply
  // nothing to show, which isn't worth breaking the page over.
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    url: row.url ?? null,
    category: row.category ?? null,
    hasUsername: Boolean(row.username_enc),
    hasNotes: Boolean(row.notes_enc),
    updatedAt: row.updated_at ?? null,
  }));
}

// Open one entry. Returns null if there's no such row — the caller turns that
// into a plain message rather than leaking whether the id existed.
export async function getPasswordSecret(id: string): Promise<PasswordSecret | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c
    .from("password_entries")
    .select("id,username_enc,password_enc,notes_enc")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const rowId = String(data.id);
  return {
    username: unseal(data.username_enc, aad(rowId, "username")),
    password: unseal(data.password_enc, aad(rowId, "password")),
    notes: unseal(data.notes_enc, aad(rowId, "notes")),
  };
}
