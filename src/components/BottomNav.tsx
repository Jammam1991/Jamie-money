"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, AlertCircle, CreditCard } from "lucide-react";

const tabs = [
  { href: "/", label: "My Cash", Icon: Home },
  { href: "/bills", label: "Bills", Icon: Receipt },
  { href: "/debt", label: "My Debt", Icon: CreditCard },
  { href: "/owes", label: "Past Due", Icon: AlertCircle },
];

// `showPastDue` is false when nothing is late — the tab disappears entirely.
export default function BottomNav({ showPastDue = true }: { showPastDue?: boolean }) {
  const pathname = usePathname();
  const visible = tabs.filter((t) => t.href !== "/owes" || showPastDue);
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card"
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
