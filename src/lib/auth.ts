import { cache } from "react";
import { cookies } from "next/headers";
import crypto from "node:crypto";

// ── Two-password gate ─────────────────────────────────────────────────────────
// Jamie logs in with JAMIE_PASSWORD to VIEW the app. Chris logs in with
// ADMIN_PASSWORD to view AND edit. Each password maps to an HMAC token kept in a
// cookie — no user table, no stored passwords. Jamie's logins are recorded so
// Chris can see how often he checks in.

export const AUTH_COOKIE = "jm_admin"; // kept the same name so old sessions survive
export type Role = "admin" | "viewer";

function hmac(pw: string, salt: string): string {
  return crypto.createHmac("sha256", pw).update(salt).digest("hex");
}

export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? hmac(pw, "jamie-admin-v1") : null;
}

export function viewerToken(): string | null {
  const pw = process.env.JAMIE_PASSWORD;
  return pw ? hmac(pw, "jamie-viewer-v1") : null;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function viewerConfigured(): boolean {
  return Boolean(process.env.JAMIE_PASSWORD);
}

function eq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Which role is the current visitor, if any.
//
// `cache` because a single page view asks four times over — the layout checks
// it, then checks "viewing as Jamie" which checks it again, and the page repeats
// both through pageGate. The answer can't change mid-request, so it's worked out
// once and handed back after that. The next request starts fresh.
export const getRole = cache(async function getRole(): Promise<Role | null> {
  const store = await cookies();
  const value = store.get(AUTH_COOKIE)?.value;
  if (!value) return null;
  const at = adminToken();
  if (at && eq(value, at)) return "admin";
  const vt = viewerToken();
  if (vt && eq(value, vt)) return "viewer";
  return null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getRole()) === "admin";
}

export async function isLoggedIn(): Promise<boolean> {
  return (await getRole()) !== null;
}

// ── The login link ────────────────────────────────────────────────────────────
// Jamie's password lives in Vercel, so he can't set or reset it himself and
// there's no "forgot password" to offer him. Instead Chris taps a button on
// Settings and Jamie gets a link that logs him straight in.
//
// The link carries its own expiry, signed with Chris's password — so there's
// nothing to store and nothing to sweep up later. Editing the expiry to buy
// more time breaks the signature, and the signature can't be worked out
// without the password. Once used, the ordinary 30-day cookie takes over.

export const LINK_MINUTES = 15;

// Signed with Chris's password rather than Jamie's: changing Jamie's password
// shouldn't invalidate a link Chris just sent, and changing Chris's password
// should kill any link still in flight.
function linkSecret(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export function linkConfigured(): boolean {
  return Boolean(linkSecret()) && viewerConfigured();
}

// `now` is passed in rather than read here so the two halves can't disagree
// about the time, and so this stays testable.
export function makeLoginLink(now: number): string | null {
  const secret = linkSecret();
  if (!secret || !viewerConfigured()) return null;
  const expires = now + LINK_MINUTES * 60_000;
  return `${expires}.${hmac(secret, `jamie-link-v1:${expires}`)}`;
}

export function loginLinkValid(key: string, now: number): boolean {
  const secret = linkSecret();
  if (!secret) return false;
  const dot = key.indexOf(".");
  if (dot < 1) return false;
  const expires = Number(key.slice(0, dot));
  if (!Number.isFinite(expires) || expires < now) return false;
  return eq(key.slice(dot + 1), hmac(secret, `jamie-link-v1:${expires}`));
}

const VIEW_AS_COOKIE = "jm_view_as";

export async function isViewingAsJamie(): Promise<boolean> {
  const admin = await isAdmin();
  if (!admin) return false;

  const store = await cookies();
  return store.get(VIEW_AS_COOKIE)?.value === "jamie";
}

// ── The password book's own lock ──────────────────────────────────────────────
// Being logged in isn't enough to see the saved logins: you have to type your
// password again, and that only holds for 15 minutes. So a phone left unlocked
// on a table, or a browser someone stayed signed in on, doesn't hand over every
// account either of them owns.
//
// The proof is a second cookie, worked out from the same password with a
// different salt — so it can't be copied out of the login cookie, or guessed
// from it.

export const VAULT_COOKIE = "jm_vault";
export const VAULT_MINUTES = 15;

export function vaultToken(role: Role): string | null {
  const pw = role === "admin" ? process.env.ADMIN_PASSWORD : process.env.JAMIE_PASSWORD;
  return pw ? hmac(pw, `jamie-vault-${role}-v1`) : null;
}

// Is the person looking right now allowed to see actual passwords? Both locks
// have to be open, and the second one has to match the role the first gave.
export async function isVaultUnlocked(): Promise<boolean> {
  const role = await getRole();
  if (!role) return false;
  const expected = vaultToken(role);
  if (!expected) return false;
  const store = await cookies();
  const value = store.get(VAULT_COOKIE)?.value;
  return Boolean(value) && eq(value!, expected);
}
