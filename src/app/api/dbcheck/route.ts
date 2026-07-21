import { createClient } from "@supabase/supabase-js";

// Temporary diagnostic. Reports what the app sees for its database config,
// WITHOUT exposing any secret values. Safe to delete once saving works.
export const dynamic = "force-dynamic";

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0] || null;

  const present = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const keyType = !key
    ? "MISSING"
    : key.startsWith("sb_secret_")
      ? "secret (correct)"
      : key.startsWith("sb_publishable_")
        ? "PUBLISHABLE — wrong, this respects RLS"
        : key.startsWith("eyJ")
          ? "legacy JWT"
          : "unknown format";

  let dbResult: unknown = "no url or key";
  if (url && key) {
    try {
      const c = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await c.from("bills").select("id").limit(1);
      dbResult = error
        ? { error: error.message, code: error.code ?? null }
        : { ok: true, rowsSeen: data?.length ?? 0 };
    } catch (e) {
      dbResult = { thrown: String(e instanceof Error ? e.message : e) };
    }
  }

  return Response.json({ projectRef, present, keyType, dbResult });
}
