export type Cloud = "AWS" | "Azure" | "GCP";
export type DisplayCurrency = "USD" | "INR";
export type CostPeriod = "monthly" | "annual";
export type WorkloadCategory = "DWH" | "ETL" | "DEV";
export type ComputeId =
  | "serverless-sql"
  | "pro-sql"
  | "classic-sql"
  | "jobs-classic"
  | "jobs-serverless"
  | "all-purpose-classic";
export type WarehouseSize =
  | "2X-Small"
  | "X-Small"
  | "Small"
  | "Medium"
  | "Large"
  | "X-Large"
  | "2X-Large"
  | "3X-Large"
  | "4X-Large"
  | "5X-Large";

export interface Workload {
  id: string;
  name: string;
  type: WorkloadCategory;
  computeId: ComputeId;
  hoursPerDay: number;
  daysPerMonth: number;
  warehouseSize: WarehouseSize;
  pipelines: number;
  driverInstance: string;
  workerInstance: string;
  workerCount: number;
  serverlessDbuPerHour: number;
}

export interface Requirements {
  cloud: Cloud;
  privateNetworking: boolean;
}

export interface Assumptions {
  region: string;
}

export interface DecisionState {
  projectName: string;
  costPeriod: CostPeriod;
  workloads: Workload[];
  activeWorkloadId: string;
  requirements: Requirements;
  budget: number;
  assumptions: Assumptions;
  currency: DisplayCurrency;
  usdToInrRate: number;
}

export interface StrategyDefinition {
  id: ComputeId;
  shortName: string;
  name: string;
  category: string;
  description: string;
  workloadType: WorkloadCategory;
  supportsPrivateNetworking: boolean;
  operationalScore: number;
  performanceLabel: string;
  performanceDetail: string;
  operationalEffort: "Low" | "Medium" | "High";
  operationalDetail: string;
  bestFor: string;
  advantages: string[];
  disadvantages: string[];
}

export interface CostBreakdown {
  cloud: Cloud;
  region: string;
  workloadType: WorkloadCategory;
  computeId: ComputeId;
  warehouseSize: WarehouseSize | null;
  monthlyHours: number;
  dbuPerHour: number;
  dbuRatePerDbu: number;
  dbuCost: number;
  includesCloudInstance: boolean;
  driverInstance: string | null;
  driverHourlyRate: number;
  workerInstance: string | null;
  workerCount: number;
  workerHourlyRate: number;
  infrastructureCost: number;
  totalHourlyRate: number;
  totalMonthlyCost: number;
}

export interface Evaluation {
  strategy: StrategyDefinition;
  workloadCost: number;
  otherWorkloadsCost: number;
  estimatedCost: number;
  costBreakdown: CostBreakdown;
  technicalFit: boolean;
  budgetFit: boolean;
  failedRequirements: string[];
  score: number;
  reasoning: string[];
  recommended: boolean;
  configured: boolean;
}

export interface ComparisonResult {
  activeWorkload: Workload;
  evaluations: Evaluation[];
  recommendation: Evaluation | null;
  currentPortfolioCost: number;
  summary: string;
}
