import type {
  MigrationInputs,
  MigrationRecommendation,
  StrategyId,
  StrategyScore,
} from "./migration-types";

export const MIGRATION_STRATEGIES: Record<StrategyId, { name: string; shortName: string; description: string }> = {
  iceberg: {
    name: "Iceberg Coexistence",
    shortName: "Iceberg",
    description: "Use Iceberg tables in S3 as an interoperable layer during a phased transition.",
  },
  federation: {
    name: "Lakehouse Federation",
    shortName: "Federation",
    description: "Let Databricks query Redshift in place while workloads are assessed and moved.",
  },
  unload: {
    name: "UNLOAD → S3",
    shortName: "UNLOAD → S3",
    description: "Bulk export Redshift data to S3 and ingest it into a Databricks-native format.",
  },
  jdbc: {
    name: "JDBC Migration",
    shortName: "JDBC",
    description: "Read a small or selective set of Redshift tables through JDBC into Databricks.",
  },
};

type Rule = {
  points: number;
  when: (input: MigrationInputs) => boolean;
  reason?: string;
  risk?: string;
};

const isLongCoexistence = (value?: MigrationInputs["coexistenceDuration"]) =>
  value === "3–6 months" || value === "> 6 months";
const isNearZero = (value: MigrationInputs["downtimeTolerance"]) => value === "Near zero";

const RULES: Record<StrategyId, Rule[]> = {
  iceberg: [
    { points: 25, when: (i) => i.keepRedshiftActive, reason: "Redshift must remain active during the transition." },
    { points: 20, when: (i) => i.sharedS3Available === "Yes", reason: "Both platforms can use an agreed S3 location." },
    { points: 15, when: (i) => isLongCoexistence(i.coexistenceDuration), reason: "The coexistence window is long enough to reward an interoperable data layer." },
    { points: 10, when: (i) => i.dataSizeGb > 1000, reason: "The data volume makes repeated full copies expensive." },
    { points: 10, when: (i) => i.targetFormat === "Iceberg", reason: "Iceberg already matches the preferred target format." },
    { points: 10, when: (i) => i.targetState === "Long-term Redshift + Databricks coexistence", reason: "The intended end-state explicitly requires cross-platform coexistence." },
    { points: 5, when: (i) => isNearZero(i.downtimeTolerance), reason: "A shared layer supports a low-disruption migration sequence." },
    { points: 5, when: (i) => i.writePattern === "Mostly append" || i.writePattern === "Mostly read-only", reason: "The write pattern reduces shared-table coordination pressure." },
    { points: -30, when: (i) => i.sharedS3Available === "No", risk: "The platforms cannot currently share the S3 layer this strategy depends on." },
    { points: -15, when: (i) => i.targetState === "Evaluate Databricks before migration", risk: "A proof of concept does not usually justify shared-table operating complexity." },
    { points: -15, when: (i) => i.specialDataTypes === "Extensive", risk: "Extensive nonstandard data types require an Iceberg compatibility assessment before choosing a shared-table design." },
    { points: -8, when: (i) => i.specialDataTypes === "Some", risk: "Validate special data types against both engines before committing to Iceberg." },
    { points: -10, when: (i) => i.keepRedshiftActive && isNearZero(i.downtimeTolerance) && ["No plan", "Unknown"].includes(i.changeSyncPlan), risk: "Near-zero downtime requires an explicit synchronization and write-ownership plan." },
  ],
  federation: [
    { points: 30, when: (i) => i.targetState === "Evaluate Databricks before migration", reason: "The immediate goal is to evaluate Databricks without moving all data." },
    { points: 20, when: (i) => i.keepRedshiftActive, reason: "Redshift remains the live source while Databricks is introduced." },
    { points: 15, when: (i) => isNearZero(i.downtimeTolerance), reason: "Querying data in place minimizes cutover disruption." },
    { points: 10, when: (i) => i.sharedS3Available === "No", reason: "Federation avoids requiring a shared S3 location." },
    { points: 10, when: (i) => i.targetState === "Only move selected workloads", reason: "Selective migration benefits from access to the remaining Redshift estate." },
    { points: 5, when: (i) => i.writePattern === "Mostly read-only", reason: "A read-heavy workload aligns with Federation's read-only access model." },
    { points: -20, when: (i) => i.targetState === "Databricks becomes primary platform", risk: "Federation is a transition mechanism, not the preferred final architecture." },
    { points: -15, when: (i) => i.dataSizeGb > 10000 && ["5–20%", "> 20%"].includes(i.dailyChangeRate), risk: "Large, frequently changing production workloads can create remote-query bottlenecks." },
    { points: -15, when: (i) => i.targetState === "Long-term Redshift + Databricks coexistence", risk: "Long-term federation retains Redshift latency, cost, and operational coupling." },
  ],
  unload: [
    { points: 25, when: (i) => i.dataSizeGb > 1000, reason: "UNLOAD is well suited to a large bulk data transfer." },
    { points: 15, when: (i) => i.largestTableGb > 100, reason: "Large individual tables favor a parallel object-storage export path." },
    { points: 20, when: (i) => i.targetState === "Databricks becomes primary platform", reason: "A clean bulk move aligns with a Databricks-primary end-state." },
    { points: 15, when: (i) => !i.keepRedshiftActive, reason: "Redshift does not need to serve workloads throughout migration." },
    { points: 10, when: (i) => i.sharedS3Available === "Yes", reason: "S3 is available as the high-throughput migration boundary." },
    { points: 10, when: (i) => i.targetFormat === "Delta Lake", reason: "The target favors a Databricks-native Delta layout." },
    { points: 5, when: (i) => i.writePattern === "Mostly append", reason: "Append-oriented data is straightforward to backfill and incrementally catch up." },
    { points: -20, when: (i) => isNearZero(i.downtimeTolerance), risk: "A bulk cutover needs a delta-sync or freeze plan to approach zero downtime." },
    { points: -10, when: (i) => isLongCoexistence(i.coexistenceDuration), risk: "A long coexistence period requires a separate change synchronization plan." },
    { points: -15, when: (i) => i.keepRedshiftActive && isNearZero(i.downtimeTolerance) && ["No plan", "Unknown"].includes(i.changeSyncPlan), risk: "The requested downtime cannot be met by bulk export alone without a catch-up mechanism." },
    { points: -8, when: (i) => i.specialDataTypes === "Extensive", risk: "Extensive type conversion increases schema and ingestion risk." },
  ],
  jdbc: [
    { points: 25, when: (i) => i.dataSizeGb < 500, reason: "The total data volume is small enough for a simpler JDBC transfer." },
    { points: 20, when: (i) => i.largestTableGb < 50, reason: "No single table is large enough to make JDBC obviously impractical." },
    { points: 15, when: (i) => i.tableCount < 50, reason: "The table inventory is small and easier to orchestrate directly." },
    { points: 15, when: (i) => i.targetState === "Only move selected workloads", reason: "JDBC is pragmatic for a selective table migration." },
    { points: 10, when: (i) => i.targetState === "Evaluate Databricks before migration", reason: "A proof of concept values simplicity over maximum throughput." },
    { points: -25, when: (i) => i.dataSizeGb > 2000, risk: "Multi-terabyte transfers are a poor fit for a JDBC data path." },
    { points: -20, when: (i) => i.largestTableGb > 500, risk: "The largest table creates a long-running, failure-prone JDBC transfer." },
    { points: -15, when: (i) => i.tableCount > 500, risk: "A very large table inventory adds orchestration and retry overhead." },
    { points: -15, when: (i) => ["5–20%", "> 20%"].includes(i.dailyChangeRate), risk: "Frequent change makes repeated JDBC extraction and reconciliation expensive." },
    { points: -10, when: (i) => ["Frequent UPDATE", "Frequent DELETE", "Mixed workload"].includes(i.writePattern), risk: "A mutation-heavy workload needs a durable incremental synchronization design." },
    { points: -10, when: (i) => i.specialDataTypes === "Extensive", risk: "Extensive type conversion is difficult to manage through a simple JDBC copy." },
  ],
};

const BASE_SCORE: Record<StrategyId, number> = { iceberg: 15, federation: 20, unload: 15, jdbc: 15 };

const COMMON_RISKS: Record<StrategyId, string[]> = {
  iceberg: [
    "Confirm catalog ownership and one clear writer for each table.",
    "Validate data types and table features against both engines.",
    "Foreign Iceberg tables in Databricks can be read-only; do not assume symmetric writes.",
  ],
  federation: [
    "Federated Redshift queries are read-only and retain source-system dependency.",
    "Validate pushdown coverage, network paths, concurrency, and result-set size.",
  ],
  unload: [
    "Plan the final change capture, validation, and cutover after the bulk export.",
    "Preserve sort, partition, security, and workload semantics during ingestion.",
  ],
  jdbc: [
    "Benchmark throughput and define restartable, partitioned reads before scaling up.",
    "Avoid using JDBC as a long-running dual-platform synchronization mechanism.",
  ],
};

const STEPS: Record<StrategyId, string[]> = {
  iceberg: [
    "Inventory Redshift tables, data types, write patterns, and dependencies.",
    "Identify tables compatible with a shared Iceberg model.",
    "Establish the S3 location, catalog ownership, and per-table writer.",
    "Migrate a representative table and validate access from both platforms.",
    "Redirect workloads gradually, then retire remaining Redshift dependencies.",
  ],
  federation: [
    "Inventory the Redshift schemas and workloads needed for evaluation.",
    "Establish network connectivity and a Unity Catalog connection.",
    "Create a foreign catalog and validate supported query pushdown.",
    "Use federated access to qualify and migrate selected workloads.",
    "Replace high-value federated queries with ingested Databricks tables.",
  ],
  unload: [
    "Inventory and classify Redshift tables and downstream dependencies.",
    "Export tables to S3 with parallel UNLOAD in a columnar format.",
    "Validate row counts, checksums, and rejected values.",
    "Ingest into Databricks Delta or Iceberg tables.",
    "Migrate SQL workloads, perform final sync, and decommission dependencies.",
  ],
  jdbc: [
    "Select the tables and define partition columns for parallel reads.",
    "Benchmark JDBC extraction on representative data.",
    "Copy tables into managed Databricks targets with restartable jobs.",
    "Validate row counts, types, and query results.",
    "Redirect selected workloads and retire their Redshift dependencies.",
  ],
};

const ARCHITECTURE: Record<StrategyId, MigrationRecommendation["architecture"]> = {
  iceberg: { nodes: ["Amazon S3 · Iceberg tables", "Amazon Redshift", "Databricks", "Existing BI", "New workloads"], edges: ["Amazon S3 · Iceberg tables → Amazon Redshift", "Amazon S3 · Iceberg tables → Databricks", "Amazon Redshift → Existing BI", "Databricks → New workloads"] },
  federation: { nodes: ["Databricks", "Lakehouse Federation", "Amazon Redshift"], edges: ["Databricks → Lakehouse Federation", "Lakehouse Federation → Amazon Redshift"] },
  unload: { nodes: ["Amazon Redshift", "UNLOAD", "Amazon S3", "Databricks", "Delta / Iceberg"], edges: ["Amazon Redshift → UNLOAD", "UNLOAD → Amazon S3", "Amazon S3 → Databricks", "Databricks → Delta / Iceberg"] },
  jdbc: { nodes: ["Amazon Redshift", "JDBC", "Databricks", "Delta / Iceberg"], edges: ["Amazon Redshift → JDBC", "JDBC → Databricks", "Databricks → Delta / Iceberg"] },
};

export function scoreMigrationStrategies(input: MigrationInputs): StrategyScore[] {
  return (Object.keys(MIGRATION_STRATEGIES) as StrategyId[])
    .map((strategyId) => {
      const matches = RULES[strategyId].filter((rule) => rule.when(input));
      const score = Math.max(0, Math.min(100, BASE_SCORE[strategyId] + matches.reduce((total, rule) => total + rule.points, 0)));
      return {
        strategyId,
        score,
        reasons: matches.flatMap((rule) => rule.points > 0 && rule.reason ? [rule.reason] : []).slice(0, 4),
        risks: [...matches.flatMap((rule) => rule.points < 0 && rule.risk ? [rule.risk] : []), ...COMMON_RISKS[strategyId]].slice(0, 4),
        assumptions: getAssumptions(input, strategyId),
      };
    })
    .sort((a, b) => b.score - a.score || ["iceberg", "unload", "federation", "jdbc"].indexOf(a.strategyId) - ["iceberg", "unload", "federation", "jdbc"].indexOf(b.strategyId));
}

function getAssumptions(input: MigrationInputs, strategyId: StrategyId): string[] {
  const assumptions: string[] = [];
  if (input.dailyChangeRate === "Unknown") assumptions.push("Daily change volume has not been measured.");
  if (input.redshiftSqlComplexity === "Unknown") assumptions.push("SQL compatibility effort is not yet known.");
  if (input.sharedS3Available === "Unknown" && (strategyId === "iceberg" || strategyId === "unload")) assumptions.push("S3 access feasibility still needs confirmation.");
  if (input.targetFormat === "Not decided" || input.targetFormat === "No preference") assumptions.push("The target table format will be selected during design.");
  return assumptions;
}

export function evaluateMigration(input: MigrationInputs): MigrationRecommendation {
  const scores = scoreMigrationStrategies(input);
  const winner = scores[0];
  const runnerUp = scores[1];
  const gap = winner.score - runnerUp.score;
  const calculatedConfidence = gap >= 15 ? "High" : gap >= 7 ? "Medium" : "Low";
  const confidence = hasCriticalUnknown(input) ? "Low" : calculatedConfidence;
  const winnerName = MIGRATION_STRATEGIES[winner.strategyId].name;
  const runnerUpName = MIGRATION_STRATEGIES[runnerUp.strategyId].name;
  const migrationApproach = getMigrationApproach(input);
  const executionOrder = getExecutionOrder(input);
  const executionReadiness = getExecutionReadiness(input);

  return {
    recommendedStrategy: { id: winner.strategyId, name: winnerName, score: winner.score },
    alternatives: scores.slice(1).map((score) => ({ id: score.strategyId, name: MIGRATION_STRATEGIES[score.strategyId].name, score: score.score })),
    reasons: winner.reasons,
    risks: winner.risks,
    assumptions: winner.assumptions,
    migrationSteps: STEPS[winner.strategyId],
    architecture: ARCHITECTURE[winner.strategyId],
    evidence: [],
    scores,
    confidence,
    confidenceExplanation: hasCriticalUnknown(input)
      ? `${winnerName} leads on strategy fit, but unresolved synchronization or compatibility inputs limit confidence.`
      : confidence === "High"
      ? `${winnerName} has a clear ${gap}-point lead for these constraints.`
      : `${winnerName} is preferred, but ${runnerUpName} is also ${gap < 7 ? "a very close" : "a strong"} option.`,
    migrationApproach,
    executionOrder,
    executionReadiness,
    cutoverChecks: getCutoverChecks(input),
    missingInformation: getMissingInformation(input),
  };
}

function getMissingInformation(input: MigrationInputs): string | undefined {
  if (input.keepRedshiftActive && ["No plan", "Unknown"].includes(input.changeSyncPlan)) return "Define how changes will be synchronized while Redshift and Databricks are both active.";
  if (input.migrationPriority === "Not decided") return "Choose whether data pipelines, BI/reporting, or a selected proof of concept should move first.";
  if (input.sharedS3Available === "Unknown") return "Confirm whether Redshift and Databricks can use the same agreed S3 location.";
  if (input.specialDataTypes === "Unknown") return "Inventory special data types and compare their Redshift-to-Databricks mappings.";
  if (input.dailyChangeRate === "Unknown") return "Measure the daily changed-data volume to shape the final synchronization plan.";
  if (input.redshiftSqlComplexity === "Unknown") return "Assess Redshift SQL and stored-procedure complexity for migration effort.";
  if (input.keepRedshiftActive && input.coexistenceDuration === "Unknown") return "Confirm how long both platforms must remain active.";
  if (input.targetState === "Not decided") return "Choose whether Databricks is an evaluation target, a selective target, or the primary platform.";
  return undefined;
}

function hasCriticalUnknown(input: MigrationInputs) {
  return (input.keepRedshiftActive && ["No plan", "Unknown"].includes(input.changeSyncPlan))
    || input.specialDataTypes === "Unknown"
    || input.migrationPriority === "Not decided";
}

function getMigrationApproach(input: MigrationInputs): MigrationRecommendation["migrationApproach"] {
  const phased = input.keepRedshiftActive
    || input.targetState === "Long-term Redshift + Databricks coexistence"
    || input.dataSizeGb > 1000
    || input.tableCount > 100
    || ["Near zero", "< 1 hour"].includes(input.downtimeTolerance);
  return phased ? "Phased migration" : "Big-bang migration";
}

function getExecutionOrder(input: MigrationInputs): MigrationRecommendation["executionOrder"] {
  if (input.migrationPriority === "Data pipelines / ETL") return "ETL-first";
  if (input.migrationPriority === "BI and reporting") return "BI-first";
  if (input.migrationPriority === "Selected workload POC") return "POC-first";
  return "Sequence not decided";
}

function getExecutionReadiness(input: MigrationInputs): MigrationRecommendation["executionReadiness"] {
  let score = 100;
  const reasons: string[] = [];
  if (input.redshiftSqlComplexity === "High") { score -= 25; reasons.push("High code and dependency complexity needs detailed discovery."); }
  else if (input.redshiftSqlComplexity === "Medium") { score -= 10; reasons.push("Some SQL, pipeline, or downstream dependencies will need refactoring."); }
  else if (input.redshiftSqlComplexity === "Unknown") { score -= 15; reasons.push("Code and dependency complexity has not been assessed."); }
  if (input.specialDataTypes === "Extensive") { score -= 25; reasons.push("Extensive special data types create material schema-conversion risk."); }
  else if (input.specialDataTypes === "Some") { score -= 10; reasons.push("Special data types need explicit target mappings."); }
  else if (input.specialDataTypes === "Unknown") { score -= 15; reasons.push("Special data types have not been inventoried."); }
  if (input.keepRedshiftActive && input.changeSyncPlan === "No plan") { score -= 30; reasons.push("No change-synchronization plan exists for the coexistence window."); }
  else if (input.keepRedshiftActive && input.changeSyncPlan === "Unknown") { score -= 20; reasons.push("The transient-state synchronization mechanism is unknown."); }
  else if (input.changeSyncPlan === "Dual-write") { score -= 10; reasons.push("Dual-write adds reconciliation and operational complexity."); }
  if (input.targetState === "Not decided") { score -= 10; reasons.push("The target operating model is not decided."); }
  if (input.migrationPriority === "Not decided") { score -= 10; reasons.push("The first migration outcome has not been prioritized."); }
  score = Math.max(0, score);
  return { score, level: score >= 75 ? "Low risk" : score >= 50 ? "Medium risk" : "High risk", reasons: reasons.slice(0, 4) };
}

function getCutoverChecks(input: MigrationInputs): string[] {
  return [
    "Automate table and schema comparison, including row/column counts, numeric aggregates, and distinct-value checks.",
    input.keepRedshiftActive ? "Run both pipelines in parallel and reconcile results throughout the agreed validation window." : "Complete a representative dry run and reconcile results before the production freeze.",
    "Validate upstream feeds, downstream applications, BI dashboards, and business KPIs against the Databricks result.",
    `Prove the ${input.changeSyncPlan === "Unknown" || input.changeSyncPlan === "No plan" ? "selected change-synchronization" : input.changeSyncPlan.toLowerCase()} path meets the downtime objective.`,
    "Define production approval, rollback, and Redshift pipeline deprecation criteria with named owners.",
  ];
}

export type ComparisonCriterion = "Data copy" | "Large datasets" | "Near-zero downtime" | "Coexistence" | "Long-term architecture" | "Migration simplicity";

export function getComparisonValue(criterion: ComparisonCriterion, strategyId: StrategyId, input: MigrationInputs): string {
  const base: Record<ComparisonCriterion, Record<StrategyId, string>> = {
    "Data copy": { iceberg: "Low", federation: "None", unload: "Required", jdbc: "Required" },
    "Large datasets": { iceberg: "Excellent", federation: "Medium", unload: "Excellent", jdbc: "Poor" },
    "Near-zero downtime": { iceberg: "Excellent", federation: "Excellent", unload: "Medium", jdbc: "Medium" },
    Coexistence: { iceberg: "Excellent", federation: "Excellent", unload: "Medium", jdbc: "Poor" },
    "Long-term architecture": { iceberg: "Excellent", federation: "Poor", unload: "Excellent", jdbc: "Medium" },
    "Migration simplicity": { iceberg: "Medium", federation: "Excellent", unload: "Medium", jdbc: "Excellent" },
  };
  let value = base[criterion][strategyId];
  if (criterion === "Large datasets" && input.dataSizeGb <= 500 && strategyId === "jdbc") value = "Excellent";
  if (criterion === "Large datasets" && input.dataSizeGb > 10000 && strategyId === "federation") value = "Poor";
  if (criterion === "Coexistence" && !input.keepRedshiftActive && strategyId === "unload") value = "Excellent";
  if (criterion === "Near-zero downtime" && input.downtimeTolerance !== "Near zero" && strategyId === "unload") value = "Good";
  if (criterion === "Data copy" && input.targetState === "Only move selected workloads" && strategyId === "jdbc") value = "Selective";
  if (criterion === "Migration simplicity" && input.tableCount > 500 && strategyId === "jdbc") value = "Poor";
  return value;
}
