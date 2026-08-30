import type { DecisionState } from "./types";
import { createDefaultWorkload } from "./workloads";

const primaryDwh = createDefaultWorkload("DWH", "workload-1", "AWS", "DataWarehouse");

export const PRIMARY_DWH_PRESET: DecisionState = {
  projectName: "Untitled project",
  costPeriod: "monthly",
  workloads: [primaryDwh],
  activeWorkloadId: primaryDwh.id,
  requirements: { cloud: "AWS", privateNetworking: true },
  budget: 3000,
  assumptions: { region: "us-east-1" },
  currency: "USD",
  usdToInrRate: 95,
};

const mixedDwh = {
  ...createDefaultWorkload("DWH", "workload-1", "AWS", "Analytics DWH"),
  computeId: "serverless-sql" as const,
  hoursPerDay: 8,
  daysPerMonth: 22,
};
const mixedEtl = {
  ...createDefaultWorkload("ETL", "workload-2", "AWS", "Daily ingestion"),
  computeId: "jobs-classic" as const,
};

export const MIXED_PRESET: DecisionState = {
  projectName: "DWH + ETL project",
  costPeriod: "monthly",
  workloads: [mixedDwh, mixedEtl],
  activeWorkloadId: mixedDwh.id,
  requirements: { cloud: "AWS", privateNetworking: false },
  budget: 5000,
  assumptions: { region: "us-east-1" },
  currency: "USD",
  usdToInrRate: 95,
};
