import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DOA Operations Hub",
  description: "Design Organization Approval — Engineering Workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} dark h-full`}>
      <body className="h-full antialiased bg-[#0F1117] text-[#E8E9F0]">
        {children}
      </body>
    </html>
  );
}
