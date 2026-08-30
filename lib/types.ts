export type WorkloadType = "streaming" | "batch";
export type Cloud = "AWS" | "Azure" | "GCP";
export type DisplayCurrency = "USD" | "INR";

export interface Workload {
  type: WorkloadType;
  description: string;
  dataVolumeGbPerDay: number;
  slaMinutes: number;
}

export interface Requirements {
  cloud: Cloud;
  privateNetworking: boolean;
}

export interface Assumptions {
  hoursPerDay: number;
  daysPerMonth: number;
  region: string;
  workerScale: number;
}

export interface DecisionState {
  workload: Workload;
  requirements: Requirements;
  budget: number;
  assumptions: Assumptions;
  currency: DisplayCurrency;
  usdToInrRate: number;
}

export interface StrategyDefinition {
  id: string;
  shortName: string;
  name: string;
  category: string;
  description: string;
  supports: WorkloadType[];
  supportsPrivateNetworking: boolean;
  minimumSlaMinutes: number;
  baseMonthlyCost: number;
  computeRate: number;
  volumeRate: number;
  operationalScore: number;
  advantages: string[];
  disadvantages: string[];
}

export interface Evaluation {
  strategy: StrategyDefinition;
  estimatedCost: number;
  technicalFit: boolean;
  budgetFit: boolean;
  failedRequirements: string[];
  score: number;
  reasoning: string[];
  recommended: boolean;
}

export interface ComparisonResult {
  evaluations: Evaluation[];
  recommendation: Evaluation | null;
  summary: string;
}
