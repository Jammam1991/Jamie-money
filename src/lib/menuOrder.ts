import { client } from "./store";
import { getRole, isViewingAsJamie } from "./auth";

// ── The order of the slide-out menu ──────────────────────────────────────────
// A list of hrefs, saved by dragging the rows around. It's only an ordering:
// the menu itself is still the list in Header.tsx, so a page can never appear
// here that doesn't exist, and one dropped from the code just falls out of the
// saved order harmlessly.
//
// Anything not in the saved list keeps its place at the end rather than
// vanishing — so adding a page later doesn't need this setting touched, and a
// half-written order can't hide a screen from anyone.
//
// Chris and Jamie each have their own. Chris keeps the original key so the
// order he already dragged into place survives.
//
// This lives in its own file rather than in store.ts because working out whose
// order it is means reading the session, and store.ts is imported by client
// components — pulling `next/headers` in through it breaks the browser bundle.
export const MENU_ORDER_KEY = "menu_order";
export const MENU_ORDER_KEY_VIEWER = "menu_order_viewer";

// Whose order to read and write, decided here from the session and never passed
// in from the browser. A key sent by the client would let Jamie hand back
// Chris's and rearrange a menu that isn't his.
//
// Viewing as Jamie reads and writes Jamie's order, because that view is meant
// to be Jamie's screen: Chris's own menu showing up there would be the one
// thing on it that wasn't the truth.
export async function menuOrderKey(): Promise<string | null> {
  const role = await getRole();
  if (role === null) return null;
  if (role !== "admin") return MENU_ORDER_KEY_VIEWER;
  return (await isViewingAsJamie()) ? MENU_ORDER_KEY_VIEWER : MENU_ORDER_KEY;
}

export async function getMenuOrder(): Promise<string[]> {
  const c = client();
  if (!c) return [];
  const key = await menuOrderKey();
  if (key === null) return [];
  const { data, error } = await c
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data?.value) return [];
  try {
    const parsed = JSON.parse(String(data.value));
    if (!Array.isArray(parsed)) return [];
    // Strings only, and each href once — a duplicate would otherwise render the
    // same row twice and drop another off the end.
    const seen = new Set<string>();
    return parsed
      .filter((h): h is string => typeof h === "string")
      .filter((h) => (seen.has(h) ? false : (seen.add(h), true)));
  } catch {
    return [];
  }
}
