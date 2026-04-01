import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DOA Operations Hub",
  description: "Design Organization Approval — Engineering Workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full antialiased bg-[#0F1117] text-[#E8E9F0]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
