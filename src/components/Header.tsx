"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Scale, CreditCard, FileText, BookOpen } from "lucide-react";

// The slide-out menu. Every row always shows — a page parked as "Coming Soon"
// on the Settings screen keeps its link and says so when Jamie opens it.
const links = [
  { href: "/job-vs-business", label: "Job vs Business", Icon: Scale },
  { href: "/debt", label: "Debt", Icon: CreditCard },
  { href: "/overall-debt", label: "Overall Debt", Icon: CreditCard },
  { href: "/credit-report", label: "Credit Report", Icon: FileText },
  { href: "/divorce", label: "Divorce", Icon: Scale },
  {
    href: "/divorce-responsibility",
    label: "The Debt Story",
    Icon: BookOpen,
  },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="text-lg font-medium"></div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 hover:bg-tint rounded-lg transition-colors"
          aria-label="Menu"
        >
          <Menu size={24} />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMenuOpen(false)} />
      )}

      {menuOpen && (
        <div className="fixed top-0 right-0 z-50 h-screen w-72 bg-card border-l border-border overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-lg font-medium">Menu</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 hover:bg-tint rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="p-4 space-y-2">
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  <span className="font-medium">{label}</span>
                </div>
                <span className="text-muted">&gt;</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
