import { redirect } from "next/navigation";
import { getRole, isViewingAsJamie, type Role } from "./auth";
import { getComingSoonPages } from "./store";
import type { PageKey } from "./pages";

// Is the person looking at the screen seeing Jamie's version of the app?
// That's Jamie himself, or Chris while "View as Jamie" is on — so Chris can
// check what he just parked without logging out.
export async function isJamieView(): Promise<boolean> {
  const role = await getRole();
  if (role === "viewer") return true;
  return role === "admin" && (await isViewingAsJamie());
}

// Every switchable page starts with this instead of its own login check.
// Logged out → the login screen. Parked on the Settings screen → the page still
// opens for Jamie, but the caller shows "Coming Soon" instead of the content.
export async function pageGate(
  key: PageKey
): Promise<{ role: Role; comingSoon: boolean }> {
  const role = await getRole();
  if (!role) redirect("/login");
  const jamieView = role === "viewer" || (await isViewingAsJamie());
  const comingSoon = jamieView && (await getComingSoonPages()).includes(key);
  return { role, comingSoon };
}
