import type { DecisionState } from "./types";

export const STREAMING_PRESET: DecisionState = {
  workload: {
    type: "streaming",
    description: "Process clickstream and transaction events continuously for near-real-time analytics.",
    dataVolumeGbPerDay: 300,
    slaMinutes: 5,
  },
  requirements: { cloud: "AWS", privateNetworking: true },
  budget: 1000,
  assumptions: { hoursPerDay: 24, daysPerMonth: 30, region: "us-east-1", workerScale: 1 },
};

export const BATCH_PRESET: DecisionState = {
  workload: {
    type: "batch",
    description: "Transform daily product and order snapshots before the morning reporting window.",
    dataVolumeGbPerDay: 180,
    slaMinutes: 60,
  },
  requirements: { cloud: "AWS", privateNetworking: false },
  budget: 900,
  assumptions: { hoursPerDay: 8, daysPerMonth: 22, region: "us-east-1", workerScale: 1 },
};
