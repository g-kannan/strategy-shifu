import type { Metadata } from "next";
import { MigrationAdvisor } from "@/components/migration-advisor";

export const metadata: Metadata = {
  title: "Redshift to Databricks Migration Strategy — StrategyShifu",
  description: "Choose the lowest-risk Redshift to Databricks migration path for your data, workload, downtime, and coexistence requirements.",
};

export default function RedshiftToDatabricksPage() {
  return <MigrationAdvisor />;
}
