import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StrategyShifu — Decide with your agent",
  description:
    "An agent-ready technical decision engine for comparing Databricks architecture strategies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
