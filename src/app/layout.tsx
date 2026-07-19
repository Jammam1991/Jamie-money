import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

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

export const viewport: Viewport = {
  themeColor: "#f6f5f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body>
        <main className="mx-auto min-h-screen max-w-md px-4 pt-6 pb-24">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
