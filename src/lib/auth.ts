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

const VIEW_AS_COOKIE = "jm_view_as";

export async function isViewingAsJamie(): Promise<boolean> {
  const admin = await isAdmin();
  if (!admin) return false;

  const store = await cookies();
  return store.get(VIEW_AS_COOKIE)?.value === "jamie";
}
