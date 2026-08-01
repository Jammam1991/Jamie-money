"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Scale, CreditCard } from "lucide-react";

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
            <Link
              href="/job-vs-business"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Scale size={20} />
                <span className="font-medium">Job vs Business</span>
              </div>
              <span className="text-muted">&gt;</span>
            </Link>
            <Link
              href="/debt"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard size={20} />
                <span className="font-medium">Debt</span>
              </div>
              <span className="text-muted">&gt;</span>
            </Link>
            <Link
              href="/divorce"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
            >
              <div className="flex items-center gap-3">
                <Scale size={20} />
                <span className="font-medium">Divorce</span>
              </div>
              <span className="text-muted">&gt;</span>
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
