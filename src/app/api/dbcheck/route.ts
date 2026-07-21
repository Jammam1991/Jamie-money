import { createClient } from "@supabase/supabase-js";

// Temporary diagnostic. Tests each full-access key against the project the app
// points to, WITHOUT exposing any secret values. Safe to delete once fixed.
export const dynamic = "force-dynamic";

async function tryKey(url: string, key: string | undefined) {
  if (!url || !key) return { present: false };
  const type = key.startsWith("sb_secret_")
    ? "secret"
    : key.startsWith("eyJ")
      ? "legacy-jwt"
      : "other";
  try {
    const c = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await c.from("bills").select("id").limit(1);
    return error
      ? { present: true, type, ok: false, error: error.message }
      : { present: true, type, ok: true, rows: data?.length ?? 0 };
  } catch (e) {
    return { present: true, type, ok: false, thrown: String(e) };
  }
}

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0] || null;

  return Response.json({
    projectRef,
    SUPABASE_SECRET_KEY: await tryKey(url, process.env.SUPABASE_SECRET_KEY),
    SUPABASE_SERVICE_ROLE_KEY: await tryKey(
      url,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  });
}
