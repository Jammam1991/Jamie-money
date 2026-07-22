import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AdminBar from "@/components/AdminBar";
import { getRole } from "@/lib/auth";

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
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body>
        <main className="mx-auto min-h-screen max-w-md px-4 pt-6 pb-24">
          <AdminBar admin={role === "admin"} loggedIn={role !== null} />
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
