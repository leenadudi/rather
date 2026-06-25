import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AnonAuthInit } from "@/components/AnonAuthInit";

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
        <AnonAuthInit />
        <Navbar />
        <div className="pb-20 md:pb-0">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
