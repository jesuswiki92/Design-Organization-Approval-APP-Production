import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMS DOA Operation Hub",
  description: "AeronauticModSpain — Design Organization Approval Operation Hub",
  openGraph: {
    title: "AMS DOA Operation Hub",
    description: "AeronauticModSpain — Design Organization Approval Operation Hub",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased bg-background text-foreground" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
