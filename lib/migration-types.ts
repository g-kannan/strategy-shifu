export type StrategyId = "iceberg" | "federation" | "unload" | "jdbc";

export type DailyChangeRate = "< 1%" | "1–5%" | "5–20%" | "> 20%" | "Unknown";
export type WritePattern = "Mostly append" | "MERGE / upsert" | "Frequent UPDATE" | "Frequent DELETE" | "Mixed workload" | "Mostly read-only";
export type SqlComplexity = "Low" | "Medium" | "High" | "Unknown";
export type CoexistenceDuration = "< 1 month" | "1–3 months" | "3–6 months" | "> 6 months" | "Unknown";
export type DowntimeTolerance = "Near zero" | "< 1 hour" | "< 1 day" | "Multiple days acceptable";
export type TriState = "Yes" | "No" | "Unknown";
export type TargetState = "Databricks becomes primary platform" | "Long-term Redshift + Databricks coexistence" | "Evaluate Databricks before migration" | "Only move selected workloads" | "Not decided";
export type TargetFormat = "Delta Lake" | "Iceberg" | "No preference" | "Not decided";
export type MigrationPriority = "Data pipelines / ETL" | "BI and reporting" | "Selected workload POC" | "Not decided";
export type ChangeSyncPlan = "Write freeze" | "Scheduled incremental loads" | "CDC / replication tool" | "Dual-write" | "No plan" | "Unknown";
export type SpecialDataTypes = "None known" | "Some" | "Extensive" | "Unknown";

export interface MigrationInputs {
  dataSizeGb: number;
  tableCount: number;
  largestTableGb: number;
  dailyChangeRate: DailyChangeRate;
  writePattern: WritePattern;
  redshiftSqlComplexity: SqlComplexity;
  keepRedshiftActive: boolean;
  coexistenceDuration?: CoexistenceDuration;
  downtimeTolerance: DowntimeTolerance;
  sharedS3Available: TriState;
  targetState: TargetState;
  targetFormat: TargetFormat;
  migrationPriority: MigrationPriority;
  changeSyncPlan: ChangeSyncPlan;
  specialDataTypes: SpecialDataTypes;
}

export interface StrategyScore {
  strategyId: StrategyId;
  score: number;
  reasons: string[];
  risks: string[];
  assumptions: string[];
}

export interface MigrationRecommendation {
  recommendedStrategy: { id: StrategyId; name: string; score: number };
  alternatives: Array<{ id: StrategyId; name: string; score: number }>;
  reasons: string[];
  risks: string[];
  assumptions: string[];
  migrationSteps: string[];
  architecture: { nodes: string[]; edges: string[] };
  evidence: Array<{ statement: string; source: string }>;
  scores: StrategyScore[];
  confidence: "High" | "Medium" | "Low";
  confidenceExplanation: string;
  migrationApproach: "Phased migration" | "Big-bang migration";
  executionOrder: "ETL-first" | "BI-first" | "POC-first" | "Sequence not decided";
  executionReadiness: {
    score: number;
    level: "Low risk" | "Medium risk" | "High risk";
    reasons: string[];
  };
  cutoverChecks: string[];
  missingInformation?: string;
}

export interface CapabilityEvidence {
  id: "redshiftIceberg" | "databricksIceberg" | "federation" | "export";
  provider: "Amazon Redshift" | "Databricks" | "Databricks Federation";
  statement: string;
  limitations: string[];
  checkedAt: string;
  fresh: boolean;
}
