import catalog from "@/resources/catalog.json";
import type { Cloud } from "./types";

export type RegionOption = {
  value: string;
  label: string;
};

const clouds = catalog.clouds as Record<Cloud, { regions: Array<{ id: string; label: string }> }>;

export const REGIONS_BY_CLOUD = Object.fromEntries(
  (Object.keys(clouds) as Cloud[]).map((cloud) => [
    cloud,
    clouds[cloud].regions.map((region) => ({
      value: region.id,
      label: `${region.label} · ${region.id}`,
    })),
  ]),
) as Record<Cloud, RegionOption[]>;

export function isRegionForCloud(cloud: Cloud, region: string): boolean {
  return REGIONS_BY_CLOUD[cloud].some((option) => option.value === region);
}
