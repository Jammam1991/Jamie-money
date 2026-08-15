import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import Header from "@/components/Header";
import AdminBar from "@/components/AdminBar";
import UpdateNotice from "@/components/UpdateNotice";
import { getRole, isViewingAsJamie } from "@/lib/auth";
import {
  getCashLog,
  getComingSoonPages,
  getMenuOrder,
  getOwesCharges,
} from "@/lib/store";
import { computePastDue, monthStart } from "@/lib/pastDue";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jamie's Money",
  description: "A simple view of how you're doing.",
  // Full-screen, app-like behavior when added to the phone's home screen.
  appleWebApp: {
    capable: true,
    title: "Jamie's Money",
    statusBarStyle: "default",
  },
};

// Render per-request so the login/logout state (from a cookie) is always
// correct on every page, including the home screen.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#f6f5f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = await getRole();
  const viewingAsJamie = await isViewingAsJamie();

  const admin = role === "admin" && !viewingAsJamie;

  // The order Chris dragged the slide-out menu into. Jamie gets the same one —
  // it's the menu, not a per-person preference.
  const menuOrder = await getMenuOrder();

  // The "Past Due" tab only exists when something is actually late. Chris keeps
  // it always so he can log new charges — and if he's parked the page as
  // "Coming Soon" for Jamie, the tab stays so Jamie sees that message.
  const comingSoon = admin ? [] : await getComingSoonPages();
  let showPastDue = admin || comingSoon.includes("owes");
  if (role && !showPastDue) {
    const [charges, cashLog] = await Promise.all([getOwesCharges(), getCashLog()]);
    const pastDue = computePastDue(
      charges,
      cashLog.filter((e) => e.kind === "to_chris"),
      monthStart()
    );
    showPastDue = pastDue.amount > 0;
  }

  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body>
        {viewingAsJamie && (
          <div className="sticky top-0 z-30 bg-blue-100 border-b-2 border-blue-300 px-4 py-2 text-center text-sm font-medium text-blue-900">
            👁️ Viewing as Jamie
          </div>
        )}
        {/* On a desktop the tabs move up here, where a mouse expects them.
            Below `md` this is hidden and the fixed bottom bar takes over —
            a thumb reaches the bottom of a phone, not the top. */}
        <TopNav showPastDue={showPastDue} />
        {/* `app-shell` carries the bottom padding: it has to clear the fixed
            nav and the home indicator on a phone, and neither exists on a
            desktop. It lives in CSS rather than an inline style because an
            inline style beats a responsive class and would keep the phone
            spacing on every screen. */}
        <main className="app-shell mx-auto min-h-screen max-w-md px-4 pt-6 md:max-w-3xl md:px-6">
          <AdminBar admin={role === "admin"} loggedIn={role !== null} viewingAsJamie={viewingAsJamie} />
          <Header admin={admin} menuOrder={menuOrder} />
          <UpdateNotice />
          {children}
        </main>
        <BottomNav showPastDue={showPastDue} />
      </body>
    </html>
  );
}
