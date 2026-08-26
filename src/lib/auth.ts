import { cache } from "react";
import { cookies } from "next/headers";
import crypto from "node:crypto";

// ── The gate ──────────────────────────────────────────────────────────────────
// Chris logs in with ADMIN_PASSWORD to view AND edit. Jamie taps a four-digit
// PIN to VIEW — the PIN lives in the app's own settings, so Chris can set it
// from his phone rather than editing Vercel and redeploying.
//
// Either way the answer is an HMAC token kept in a cookie — no user table, no
// stored passwords. Jamie's logins are recorded so Chris can see how often he
// checks in.
//
// Nothing here expires. Jamie taps the link once, types the PIN once, and the
// app stays open on his home screen from then on.

export const AUTH_COOKIE = "jm_admin"; // kept the same name so old sessions survive
export type Role = "admin" | "viewer";

function hmac(pw: string, salt: string): string {
  return crypto.createHmac("sha256", pw).update(salt).digest("hex");
}

export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? hmac(pw, "jamie-admin-v1") : null;
}

// Seeded from Chris's password rather than Jamie's PIN: the PIN is a thing
// Chris changes from his phone, and changing it shouldn't sign Jamie out of a
// phone that's already trusted. Rotating ADMIN_PASSWORD still clears everyone.
export function viewerToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? hmac(pw, "jamie-viewer-v2") : null;
}

// The old JAMIE_PASSWORD token, still honoured so a session opened before the
// PIN existed survives. Only live while that variable is set.
function legacyViewerToken(): string | null {
  const pw = process.env.JAMIE_PASSWORD;
  return pw ? hmac(pw, "jamie-viewer-v1") : null;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// Jamie's side is ready as soon as Chris's password exists — his PIN is set
// in the app, not here, so it's never a deploy-time question.
export function viewerConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
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
  const lt = legacyViewerToken();
  if (lt && eq(value, lt)) return "viewer";
  return null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getRole()) === "admin";
}

export async function isLoggedIn(): Promise<boolean> {
  return (await getRole()) !== null;
}

// ── How long a session lasts ──────────────────────────────────────────────────
// Ten years, which is "never" as far as a phone is concerned. The point of the
// PIN is that Jamie opens the app from his home screen and it's just there —
// meeting a login screen every month is the thing that makes him stop looking.
export const SESSION_DAYS = 3650;

export function sessionCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  };
}

// ── Jamie's PIN ───────────────────────────────────────────────────────────────
// Four digits, because it's typed on a phone by someone who shouldn't have to
// remember a password. What's stored is an HMAC of it, keyed with Chris's
// password — so the settings row on its own gives nothing away, and nobody,
// Chris included, can read the PIN back out later. Forgotten means "set a new
// one", not "recover the old one".
//
// Four digits is only 10,000 guesses, so the login action counts wrong tries
// and shuts the door for a while — see PIN_TRIES in store.ts. Without that this
// would be a weekend's work to walk through.

export const PIN_LENGTH = 4;

export function isPin(value: string): boolean {
  return new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(value);
}

export function pinHash(pin: string): string | null {
  const secret = process.env.ADMIN_PASSWORD;
  return secret ? hmac(secret, `jamie-pin-v1:${pin}`) : null;
}

export function pinMatches(pin: string, stored: string | null): boolean {
  const h = pinHash(pin);
  return Boolean(h && stored && eq(h, stored));
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

// Both roles hang off ADMIN_PASSWORD now — Jamie's half of the lock is his
// PIN, which lives in the database, so there's no env var of his to key on.
// Different salts keep the two tokens unrelated.
export function vaultToken(role: Role): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return hmac(pw, role === "admin" ? "jamie-vault-admin-v1" : "jamie-vault-viewer-v2");
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
