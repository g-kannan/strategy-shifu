import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Databricks Cost Advisor — StrategyShifu",
  description:
    "An agent-ready decision engine for regional Databricks SQL warehouse sizing and pricing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
