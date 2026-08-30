import type { Cloud } from "./types";

export type RegionOption = {
  value: string;
  label: string;
};

// Deliberately limited demo region set: one US East option and one India option
// for each cloud, using that provider's native region identifiers.
export const REGIONS_BY_CLOUD: Record<Cloud, RegionOption[]> = {
  AWS: [
    { value: "us-east-1", label: "US East · us-east-1" },
    { value: "ap-south-1", label: "India · ap-south-1" },
  ],
  Azure: [
    { value: "eastus", label: "US East · eastus" },
    { value: "centralindia", label: "India · centralindia" },
  ],
  GCP: [
    { value: "us-east1", label: "US East · us-east1" },
    { value: "asia-south1", label: "India · asia-south1" },
  ],
};

export function isRegionForCloud(cloud: Cloud, region: string): boolean {
  return REGIONS_BY_CLOUD[cloud].some((option) => option.value === region);
}
