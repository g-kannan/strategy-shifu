import type { Cloud, ComputeId, Workload, WorkloadCategory } from "./types";
import { getDefaultClusterInstance, getWorkloadComputeOptions, isInstanceForCloud } from "./pricing";

export const DEFAULT_COMPUTE_BY_TYPE: Record<WorkloadCategory, ComputeId> = {
  DWH: "serverless-sql",
  ETL: "jobs-serverless",
  DEV: "all-purpose-classic",
};

const DEFAULT_NAME_BY_TYPE: Record<WorkloadCategory, string> = {
  DWH: "DataWarehouse",
  ETL: "ETL pipeline",
  DEV: "Development",
};

function getDefaultWorkloadName(type: WorkloadCategory, id: string): string {
  const sequence = Number(id.match(/(\d+)$/)?.[1] ?? 1);
  return `${DEFAULT_NAME_BY_TYPE[type]}${sequence > 1 ? ` ${sequence}` : ""}`;
}

export function createDefaultWorkload(
  type: WorkloadCategory,
  id: string,
  cloud: Cloud,
  name?: string,
): Workload {
  const instance = getDefaultClusterInstance(cloud);
  return {
    id,
    name: name ?? getDefaultWorkloadName(type, id),
    type,
    computeId: DEFAULT_COMPUTE_BY_TYPE[type],
    naturalLanguageAnalytics: false,
    hoursPerDay: type === "ETL" ? 3 : type === "DEV" ? 8 : 24,
    daysPerMonth: type === "ETL" ? 30 : type === "DEV" ? 22 : 31,
    warehouseSize: "2X-Small",
    pipelines: 1,
    driverInstance: instance,
    workerInstance: instance,
    workerCount: 2,
    serverlessDbuPerHour: 4,
  };
}

export function changeWorkloadType(workload: Workload, type: WorkloadCategory): Workload {
  return {
    ...workload,
    name: getDefaultWorkloadName(type, workload.id),
    type,
    computeId: DEFAULT_COMPUTE_BY_TYPE[type],
    naturalLanguageAnalytics: type === "DWH" ? workload.naturalLanguageAnalytics : false,
  };
}

export function isComputeForWorkload(type: WorkloadCategory, computeId: string): computeId is ComputeId {
  return getWorkloadComputeOptions(type).some((option) => option.id === computeId);
}

export function normalizeWorkloadForCloud(workload: Workload, cloud: Cloud): Workload {
  const fallback = getDefaultClusterInstance(cloud);
  return {
    ...workload,
    driverInstance: isInstanceForCloud(cloud, workload.driverInstance) ? workload.driverInstance : fallback,
    workerInstance: isInstanceForCloud(cloud, workload.workerInstance) ? workload.workerInstance : fallback,
  };
}

export function nextWorkloadId(workloads: Workload[]): string {
  let next = 1;
  const used = new Set(workloads.map((workload) => workload.id));
  while (used.has(`workload-${next}`)) next += 1;
  return `workload-${next}`;
}
