import type { DecisionState, Workload } from "./types";
import type { MigrationInputs } from "./migration-types";

type ShareKind = "cost" | "migration";
type SharePayload = { version: 1; kind: ShareKind; state: unknown };

export function createShareUrl(kind: ShareKind, state: DecisionState | MigrationInputs) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", encodePayload({ version: 1, kind, state }));
  return url.toString();
}

export function readSharedState<T>(kind: ShareKind, isValid: (value: unknown) => value is T): T | null {
  try {
    const encoded = new URLSearchParams(window.location.search).get("share");
    if (!encoded) return null;
    const payload = decodePayload(encoded);
    return payload?.version === 1 && payload.kind === kind && isValid(payload.state) ? payload.state : null;
  } catch {
    return null;
  }
}

export function isDecisionState(value: unknown): value is DecisionState {
  if (!isRecord(value)) return false;
  return typeof value.projectName === "string"
    && isOneOf(value.costPeriod, ["monthly", "annual"])
    && Array.isArray(value.workloads)
    && value.workloads.length > 0
    && value.workloads.every(isWorkload)
    && typeof value.activeWorkloadId === "string"
    && value.workloads.some((workload) => workload.id === value.activeWorkloadId)
    && isRecord(value.requirements)
    && isOneOf(value.requirements.cloud, ["AWS", "Azure", "GCP"])
    && typeof value.requirements.privateNetworking === "boolean"
    && isRecord(value.assumptions)
    && typeof value.assumptions.region === "string"
    && isFiniteNumber(value.budget)
    && value.budget >= 0
    && isOneOf(value.currency, ["USD", "INR"])
    && isFiniteNumber(value.usdToInrRate)
    && value.usdToInrRate > 0;
}

export function isMigrationInputs(value: unknown): value is MigrationInputs {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.dataSizeGb)
    && value.dataSizeGb >= 0
    && isFiniteNumber(value.tableCount)
    && value.tableCount >= 0
    && isFiniteNumber(value.largestTableGb)
    && value.largestTableGb >= 0
    && isOneOf(value.dailyChangeRate, ["< 1%", "1–5%", "5–20%", "> 20%", "Unknown"])
    && isOneOf(value.writePattern, ["Mostly append", "MERGE / upsert", "Frequent UPDATE", "Frequent DELETE", "Mixed workload", "Mostly read-only"])
    && isOneOf(value.redshiftSqlComplexity, ["Low", "Medium", "High", "Unknown"])
    && typeof value.keepRedshiftActive === "boolean"
    && (value.coexistenceDuration === undefined || isOneOf(value.coexistenceDuration, ["< 1 month", "1–3 months", "3–6 months", "> 6 months", "Unknown"]))
    && isOneOf(value.downtimeTolerance, ["Near zero", "< 1 hour", "< 1 day", "Multiple days acceptable"])
    && isOneOf(value.sharedS3Available, ["Yes", "No", "Unknown"])
    && isOneOf(value.targetState, ["Databricks becomes primary platform", "Long-term Redshift + Databricks coexistence", "Evaluate Databricks before migration", "Only move selected workloads", "Not decided"])
    && isOneOf(value.targetFormat, ["Delta Lake", "Iceberg", "No preference", "Not decided"])
    && isOneOf(value.migrationPriority, ["Data pipelines / ETL", "BI and reporting", "Selected workload POC", "Not decided"])
    && isOneOf(value.changeSyncPlan, ["Write freeze", "Scheduled incremental loads", "CDC / replication tool", "Dual-write", "No plan", "Unknown"])
    && isOneOf(value.specialDataTypes, ["None known", "Some", "Extensive", "Unknown"]);
}

function isWorkload(value: unknown): value is Workload {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.name === "string"
    && isOneOf(value.type, ["DWH", "ETL", "DEV"])
    && isOneOf(value.computeId, ["serverless-sql", "pro-sql", "classic-sql", "jobs-classic", "jobs-serverless", "all-purpose-classic"])
    && typeof value.naturalLanguageAnalytics === "boolean"
    && isFiniteNumber(value.hoursPerDay)
    && value.hoursPerDay >= 1
    && value.hoursPerDay <= 24
    && isFiniteNumber(value.daysPerMonth)
    && value.daysPerMonth >= 1
    && value.daysPerMonth <= 31
    && isOneOf(value.warehouseSize, ["2X-Small", "X-Small", "Small", "Medium", "Large", "X-Large", "2X-Large", "3X-Large", "4X-Large", "5X-Large"])
    && isFiniteNumber(value.pipelines)
    && value.pipelines >= 1
    && typeof value.driverInstance === "string"
    && typeof value.workerInstance === "string"
    && isFiniteNumber(value.workerCount)
    && value.workerCount >= 1
    && isFiniteNumber(value.serverlessDbuPerHour)
    && value.serverlessDbuPerHour >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function encodePayload(payload: SharePayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodePayload(encoded: string): SharePayload | null {
  const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (encoded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return isRecord(payload) && payload.version === 1 && isOneOf(payload.kind, ["cost", "migration"])
    ? payload as SharePayload
    : null;
}
