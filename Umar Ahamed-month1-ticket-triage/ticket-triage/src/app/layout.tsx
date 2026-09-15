import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMO Triage Board",
  description:
    "Bistec Global PMO delivery-blocker triage board — grouped by priority.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="en">
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
