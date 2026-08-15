"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Scale, CreditCard, FileText, BookOpen, Building2, Landmark, Dumbbell, Compass, Briefcase, HeartHandshake, Home } from "lucide-react";

// The slide-out menu. Every row always shows — a page parked as "Coming Soon"
// on the Settings screen keeps its link and says so when Jamie opens it.
const links = [
  // First, because it's the one that frames everything under it.
  { href: "/big-picture", label: "The Big Picture", Icon: Compass },
  { href: "/job-vs-business", label: "Job vs Business", Icon: Scale },
  // Sits right under it — that page asks "job or gym?", this one is what to do
  // about it once the answer is a job.
  { href: "/career", label: "Career", Icon: Briefcase },
  { href: "/debt", label: "Debt", Icon: CreditCard },
  { href: "/credit-report", label: "Credit Report", Icon: FileText },
  // Sits right under those two — it's the same card and car payments read
  // forwards, into the house they still allow room for.
  { href: "/home-buying", label: "Home Buying", Icon: Home },
  { href: "/business-finances", label: "Business Finances", Icon: Building2 },
  { href: "/tax-center", label: "Tax Center", Icon: Landmark },
  { href: "/divorce", label: "Divorce", Icon: Scale },
  // Sits right under it — that page is the mechanics of splitting up, this one
  // is what the splitting up would actually cost.
  { href: "/married-vs-divorce", label: "Married vs Divorce", Icon: HeartHandshake },
  {
    href: "/story",
    label: "The Debt Story",
    Icon: BookOpen,
  },
  { href: "/gym-story", label: "Gym Story", Icon: Dumbbell },
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
