import { createClient } from "@supabase/supabase-js";

// Temporary diagnostic. Tests the app's existing keys against a project URL,
// WITHOUT exposing secret values. Pass ?url=https://<ref>.supabase.co to test
// the current keys against a different project. Safe to delete once fixed.
export const dynamic = "force-dynamic";

function refOf(u: string) {
  return u.replace(/^https?:\/\//, "").split(".")[0] || null;
}

async function tryKey(url: string, key: string | undefined) {
  if (!url || !key) return { present: false };
  try {
    const c = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await c.from("bills").select("id").limit(1);
    return error
      ? { present: true, ok: false, error: error.message }
      : { present: true, ok: true, rows: data?.length ?? 0 };
  } catch (e) {
    return { present: true, ok: false, thrown: String(e) };
  }
}

export async function GET(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const testUrl = new URL(req.url).searchParams.get("url") || envUrl;

  return Response.json({
    appProject: refOf(envUrl),
    testedProject: refOf(testUrl),
    secretKey: await tryKey(testUrl, process.env.SUPABASE_SECRET_KEY),
    serviceRoleKey: await tryKey(testUrl, process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
