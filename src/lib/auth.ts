import { cookies } from "next/headers";
import crypto from "node:crypto";

// ── Simple single-password admin gate ─────────────────────────────────────────
// Only Chris (who knows ADMIN_PASSWORD) can edit. Everyone else sees a
// read-only app. There is no database or user table involved: the password
// lives in an environment variable, and a signed cookie proves you logged in.
//
// The cookie never contains the password — it holds an HMAC derived from it, so
// it can't be forged without knowing the password, and changing the password
// automatically logs old sessions out.

export const ADMIN_COOKIE = "jm_admin";

// The exact cookie value a logged-in admin should have, or null if no password
// has been configured yet.
export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return crypto.createHmac("sha256", pw).update("jamie-admin-v1").digest("hex");
}

// Has Chris set up a password at all?
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// Is the current visitor logged in as admin?
export async function isAdmin(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
