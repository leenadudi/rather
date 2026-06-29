import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { VoteClaimer } from "@/components/VoteClaimer";

export const metadata: Metadata = {
  title: "would you rather",
  description: "one question a day. two choices. see where you stand.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-background min-h-screen">
        <VoteClaimer />
        <Navbar />
        <div className="pb-20 md:pb-0">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
