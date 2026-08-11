"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/lib/navTabs";

// `showPastDue` is false when nothing is late — the tab disappears entirely.
// Pages parked as "Coming Soon" keep their tab; the page itself does the
// talking.
export default function BottomNav({ showPastDue = true }: { showPastDue?: boolean }) {
  const pathname = usePathname();
  const visible = NAV_TABS.filter((t) => t.href !== "/owes" || showPastDue);
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
              className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px]"
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
