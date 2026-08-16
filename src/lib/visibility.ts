import { redirect } from "next/navigation";
import { getRole, isViewingAsJamie, type Role } from "./auth";
import { getComingSoonPages, getRemovedPages } from "./store";
import type { PageKey } from "./pages";

// Is the person looking at the screen seeing Jamie's version of the app?
// That's Jamie himself, or Chris while "View as Jamie" is on — so Chris can
// check what he just changed without logging out.
export async function isJamieView(): Promise<boolean> {
  const role = await getRole();
  if (role === "viewer") return true;
  return role === "admin" && (await isViewingAsJamie());
}

// The two lists that shape Jamie's app, read once and already emptied for
// Chris — he keeps every link and every real page.
export async function jamiePageState(): Promise<{
  jamieView: boolean;
  comingSoon: string[];
  removed: string[];
}> {
  const jamieView = await isJamieView();
  if (!jamieView) return { jamieView, comingSoon: [], removed: [] };
  const [comingSoon, removed] = await Promise.all([
    getComingSoonPages(),
    getRemovedPages(),
  ]);
  return { jamieView, comingSoon, removed };
}

// Every switchable page starts with this instead of its own login check.
//
//   logged out    → the login screen
//   coming soon   → the page still opens for Jamie, and the caller shows the
//                   "Coming Soon" placeholder instead of the content
//   removed       → the page isn't part of Jamie's app at all, so typing the
//                   address lands him back on My Cash rather than on a screen
//                   he has no link to
export async function pageGate(
  key: PageKey
): Promise<{ role: Role; comingSoon: boolean }> {
  const role = await getRole();
  if (!role) redirect("/login");
  const jamieView = role === "viewer" || (await isViewingAsJamie());
  if (!jamieView) return { role, comingSoon: false };
  if ((await getRemovedPages()).includes(key)) redirect("/");
  return { role, comingSoon: (await getComingSoonPages()).includes(key) };
}
