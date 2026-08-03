import { redirect } from "next/navigation";
import { getRole, isViewingAsJamie, type Role } from "./auth";
import { getHiddenPages } from "./store";
import type { PageKey } from "./pages";

// Is the person looking at the screen seeing Jamie's version of the app?
// That's Jamie himself, or Chris while "View as Jamie" is on — so Chris can
// check what he just hid without logging out.
export async function isJamieView(): Promise<boolean> {
  const role = await getRole();
  if (role === "viewer") return true;
  return role === "admin" && (await isViewingAsJamie());
}

// Every switchable page starts with this instead of its own login check.
// Logged out → the login screen. Switched off for Jamie → back home.
export async function requireVisible(key: PageKey): Promise<Role> {
  const role = await getRole();
  if (!role) redirect("/login");
  const jamieView = role === "viewer" || (await isViewingAsJamie());
  if (jamieView && (await getHiddenPages()).includes(key)) redirect("/");
  return role;
}
