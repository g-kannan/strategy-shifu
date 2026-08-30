import catalogJson from "@/resources/catalog.json";
import pricingSourcesJson from "@/resources/pricing-sources.json";
import type {
  Cloud,
  ComputeId,
  CostBreakdown,
  DecisionState,
  WarehouseSize,
  Workload,
  WorkloadCategory,
} from "./types";

export type WarehouseDefinition = {
  size: WarehouseSize;
  instance: string;
  workers: number;
  vcpu: number;
  memoryGiB: number;
  dbuPerHour: number;
};

export type InstanceDefinition = {
  id: string;
  family: string;
  featured: boolean;
  vcpu: number;
  memoryGiB: number;
  dbuPerHour: number;
};

export type ComputeOption = { id: ComputeId; label: string; multiplier: number };

type DbuPricingRow = {
  cloud: Cloud;
  regionId: string;
  workloadType: WorkloadCategory;
  computeId: ComputeId;
  ratePerDbu: number;
  includesCloudInstance: boolean;
};

type VmRate = { instanceId: string; hourlyUsd: number };

type PricingCatalog = {
  defaults: {
    selectedWarehouseSize: WarehouseSize;
    warehouseWorkerInstanceByCloud: Record<Cloud, string>;
  };
  warehouses: WarehouseDefinition[];
  instancesByCloud: Record<Cloud, InstanceDefinition[]>;
  workloadCatalog: Record<WorkloadCategory, {
    label: string;
    description: string;
    compute: ComputeOption[];
  }>;
  dbuPricing: DbuPricingRow[];
  vmHourlyRates: {
    source: string;
    refreshedAt: string;
    AWS: Record<string, VmRate[]>;
    Azure: Record<string, VmRate[]>;
    GCP: Record<string, VmRate[]>;
  };
};

const catalog = catalogJson as PricingCatalog;
const pricingSources = pricingSourcesJson as Record<Cloud, { label: string; url: string }>;

export const WAREHOUSES = catalog.warehouses;
export const WAREHOUSE_SIZES = WAREHOUSES.map((warehouse) => warehouse.size);
export const DEFAULT_WAREHOUSE_SIZE = catalog.defaults.selectedWarehouseSize;
export const VM_PRICING_SOURCE = catalog.vmHourlyRates.source;
export const VM_PRICING_REFRESHED_AT = catalog.vmHourlyRates.refreshedAt;
export const WORKLOAD_CATEGORIES = (["DWH", "ETL", "DEV"] as WorkloadCategory[]).map((id) => ({
  id,
  ...catalog.workloadCatalog[id],
}));

export function getPricingSource(cloud: Cloud) {
  return pricingSources[cloud];
}

export function getWorkloadComputeOptions(type: WorkloadCategory): ComputeOption[] {
  return catalog.workloadCatalog[type].compute;
}

export function getInstancesForCloud(cloud: Cloud): InstanceDefinition[] {
  return catalog.instancesByCloud[cloud];
}

export function getDefaultClusterInstance(cloud: Cloud): string {
  return getInstancesForCloud(cloud).find(
    (instance) => instance.featured && instance.family === "General purpose",
  )?.id ?? getInstancesForCloud(cloud)[0].id;
}

export function isInstanceForCloud(cloud: Cloud, value: string): boolean {
  return getInstancesForCloud(cloud).some((instance) => instance.id === value);
}

export function isWarehouseSize(value: string): value is WarehouseSize {
  return WAREHOUSE_SIZES.includes(value as WarehouseSize);
}

export function getWarehouse(size: WarehouseSize): WarehouseDefinition {
  const warehouse = WAREHOUSES.find((candidate) => candidate.size === size);
  if (!warehouse) throw new Error(`Unknown DWH size: ${size}`);
  return warehouse;
}

export function getMonthlyHours(hoursPerDay: number, daysPerMonth: number): number {
  return hoursPerDay === 24 && daysPerMonth === 31 ? 730 : hoursPerDay * daysPerMonth;
}

function getDbuRate(
  cloud: Cloud,
  region: string,
  workloadType: WorkloadCategory,
  computeId: ComputeId,
): DbuPricingRow {
  const row = catalog.dbuPricing.find(
    (candidate) =>
      candidate.cloud === cloud &&
      candidate.regionId === region &&
      candidate.workloadType === workloadType &&
      candidate.computeId === computeId,
  );
  if (!row) throw new Error(`No ${workloadType} DBU rate for ${computeId} in ${cloud}/${region}.`);
  return row;
}

function getVmRate(cloud: Cloud, region: string, instanceId: string): number {
  const regionRates = catalog.vmHourlyRates[cloud][region];
  const row = regionRates?.find((candidate) => candidate.instanceId === instanceId);
  if (!row) throw new Error(`No VM rate for ${instanceId} in ${cloud}/${region}.`);
  return row.hourlyUsd;
}

function getInstance(cloud: Cloud, instanceId: string): InstanceDefinition {
  const instance = getInstancesForCloud(cloud).find((candidate) => candidate.id === instanceId);
  if (!instance) throw new Error(`Unknown instance ${instanceId} for ${cloud}.`);
  return instance;
}

function getWarehouseDriverInstance(cloud: Cloud, warehouse: WarehouseDefinition): string {
  if (cloud === "AWS") return warehouse.instance;
  if (cloud === "Azure") return `Standard_E${warehouse.vcpu}ds_v4`;
  return `n2-highmem-${warehouse.vcpu}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateWorkloadCost(
  workload: Workload,
  decision: DecisionState,
  computeId: ComputeId = workload.computeId,
): CostBreakdown {
  const { cloud } = decision.requirements;
  const { region } = decision.assumptions;
  const monthlyHours = getMonthlyHours(workload.hoursPerDay, workload.daysPerMonth);
  const price = getDbuRate(cloud, region, workload.type, computeId);

  let warehouseSize: WarehouseSize | null = null;
  let dbuPerHour = 0;
  let driverInstance: string | null = null;
  let workerInstance: string | null = null;
  let workerCount = 0;
  let driverHourlyRate = 0;
  let workerHourlyRate = 0;
  let scale = 1;

  if (workload.type === "DWH") {
    const warehouse = getWarehouse(workload.warehouseSize);
    warehouseSize = warehouse.size;
    dbuPerHour = warehouse.dbuPerHour;
    workerCount = warehouse.workers;
    if (!price.includesCloudInstance) {
      driverInstance = getWarehouseDriverInstance(cloud, warehouse);
      workerInstance = catalog.defaults.warehouseWorkerInstanceByCloud[cloud];
    }
  } else if (computeId === "jobs-serverless") {
    dbuPerHour = workload.serverlessDbuPerHour;
    scale = workload.pipelines;
  } else {
    driverInstance = workload.driverInstance;
    workerInstance = workload.workerInstance;
    workerCount = workload.workerCount;
    dbuPerHour =
      getInstance(cloud, driverInstance).dbuPerHour +
      workerCount * getInstance(cloud, workerInstance).dbuPerHour;
    scale = workload.type === "ETL" ? workload.pipelines : 1;
  }

  if (!price.includesCloudInstance && driverInstance && workerInstance) {
    driverHourlyRate = getVmRate(cloud, region, driverInstance);
    workerHourlyRate = getVmRate(cloud, region, workerInstance);
  }

  const dbuHourlyRate = dbuPerHour * price.ratePerDbu;
  const infrastructureHourlyRate = driverHourlyRate + workerCount * workerHourlyRate;
  const dbuCost = dbuHourlyRate * monthlyHours * scale;
  const infrastructureCost = infrastructureHourlyRate * monthlyHours * scale;
  const totalMonthlyCost = dbuCost + infrastructureCost;

  return {
    cloud,
    region,
    workloadType: workload.type,
    computeId,
    warehouseSize,
    monthlyHours,
    dbuPerHour,
    dbuRatePerDbu: price.ratePerDbu,
    dbuCost: roundMoney(dbuCost),
    includesCloudInstance: price.includesCloudInstance,
    driverInstance,
    driverHourlyRate,
    workerInstance,
    workerCount,
    workerHourlyRate,
    infrastructureCost: roundMoney(infrastructureCost),
    totalHourlyRate: roundMoney((dbuHourlyRate + infrastructureHourlyRate) * scale),
    totalMonthlyCost: roundMoney(totalMonthlyCost),
  };
}

export function getPricingOptions(cloud: Cloud, region: string, type: WorkloadCategory) {
  return {
    cloud,
    region,
    workloadType: type,
    computeOptions: getWorkloadComputeOptions(type),
    warehouseSizes: type === "DWH" ? WAREHOUSES : [],
    instances: type === "DWH" ? [] : getInstancesForCloud(cloud),
    computeRates: catalog.dbuPricing.filter(
      (row) => row.cloud === cloud && row.regionId === region && row.workloadType === type,
    ),
    vmRates: catalog.vmHourlyRates[cloud][region],
    vmPricingSource: VM_PRICING_SOURCE,
    vmPricingRefreshedAt: VM_PRICING_REFRESHED_AT,
    pricingReference: getPricingSource(cloud),
  };
}
