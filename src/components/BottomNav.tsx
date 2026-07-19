"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Scale, CreditCard } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/divorce", label: "Divorce", Icon: Scale },
  { href: "/debt", label: "Debt", Icon: CreditCard },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ href, label, Icon }) => {
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
