"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageByKey, type PageKey } from "@/lib/pages";

// The phone's bottom bar. Which tabs are on it is decided on the server — Chris
// arranges them on the Settings screen, Past Due only turns up when something's
// late, and anything he's taken off Jamie's screen never reaches this list.
//
// Only the keys come down; the label and icon are looked up here, so a renamed
// page can't say one thing in the bar and another in the menu.
export default function BottomNav({ tabs }: { tabs: PageKey[] }) {
  const pathname = usePathname();
  const visible = tabs.map(pageByKey).filter((p) => p !== undefined);
  if (visible.length === 0) return null;
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card md:hidden"
      // The layout uses viewportFit: "cover", so the bar reaches into the home
      // indicator area. Pad it so the labels never sit under the indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md">
        {visible.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-center text-[11px]"
              style={{ color: active ? "var(--text)" : "var(--muted)" }}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
