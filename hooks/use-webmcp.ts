"use client";

import { useEffect, useRef, useState } from "react";
import { compareStrategies, estimatePortfolioCost } from "@/lib/decision-engine";
import {
  calculateWorkloadCost,
  getPricingOptions,
  isInstanceForCloud,
  isWarehouseSize,
  WAREHOUSE_SIZES,
} from "@/lib/pricing";
import { isRegionForCloud, REGIONS_BY_CLOUD } from "@/lib/regions";
import type {
  Cloud,
  CostPeriod,
  ComputeId,
  DecisionState,
  DisplayCurrency,
  WarehouseSize,
  Workload,
  WorkloadCategory,
} from "@/lib/types";
import {
  changeWorkloadType,
  createDefaultWorkload,
  isComputeForWorkload,
  nextWorkloadId,
  normalizeWorkloadForCloud,
} from "@/lib/workloads";

type ConnectionState = "checking" | "connected" | "unavailable";

export type WebMCPToolSummary = {
  name: string;
  title?: string;
  description: string;
};

function result(payload: unknown): WebMCPToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export function useWebMCP(
  decision: DecisionState,
  onDecisionChange: (next: DecisionState) => void,
): { connection: ConnectionState; tools: WebMCPToolSummary[] } {
  const decisionRef = useRef(decision);
  const changeRef = useRef(onDecisionChange);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [availableTools, setAvailableTools] = useState<WebMCPToolSummary[]>([]);

  useEffect(() => { decisionRef.current = decision; }, [decision]);
  useEffect(() => { changeRef.current = onDecisionChange; }, [onDecisionChange]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setConnection("unavailable");
      setAvailableTools([]);
      return;
    }

    const controller = new AbortController();
    const mutate = (update: (current: DecisionState) => DecisionState) => {
      const next = update(decisionRef.current);
      decisionRef.current = next;
      changeRef.current(next);
      return next;
    };
    const updateWorkload = (
      current: DecisionState,
      workloadId: string,
      update: (workload: Workload) => Workload,
    ): DecisionState => {
      if (!current.workloads.some((workload) => workload.id === workloadId)) {
        throw new Error(`Unknown workload: ${workloadId}`);
      }
      return {
        ...current,
        workloads: current.workloads.map((workload) => workload.id === workloadId ? update(workload) : workload),
      };
    };

    const workloadProperties = {
      name: { type: "string" },
      type: { type: "string", enum: ["DWH", "ETL", "DEV"] },
      computeId: { type: "string", enum: ["serverless-sql", "pro-sql", "classic-sql", "jobs-classic", "jobs-serverless", "all-purpose-classic"] },
      naturalLanguageAnalytics: { type: "boolean", description: "Set true when users need chat-based or NLP questions over data; this requires Databricks Genie on Serverless or Pro SQL." },
      warehouseSize: { type: "string", enum: WAREHOUSE_SIZES },
      driverInstance: { type: "string" },
      workerInstance: { type: "string" },
      workerCount: { type: "number", minimum: 1, maximum: 1000 },
      pipelines: { type: "number", minimum: 1, maximum: 1000 },
      serverlessDbuPerHour: { type: "number", minimum: 0.01, maximum: 10000 },
    };

    const tools: WebMCPTool[] = [
      {
        name: "get_decision_state",
        title: "Get decision state",
        description: "Read the project workloads, active workload, requirements, budget, regional assumptions, and current recommendation.",
        execute: () => result({ decision: decisionRef.current, comparison: compareStrategies(decisionRef.current) }),
      },
      {
        name: "list_workloads",
        title: "List workloads",
        description: "List every configured workload and identify the workload currently being edited.",
        execute: () => result({
          activeWorkloadId: decisionRef.current.activeWorkloadId,
          workloads: decisionRef.current.workloads,
        }),
      },
      {
        name: "add_workload",
        title: "Add workload",
        description: "Add a named DWH, ETL, or development workload with category-appropriate defaults and select it for editing.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["DWH", "ETL", "DEV"] },
          },
          additionalProperties: false,
        },
        execute: (input) => {
          const type = (input.type ?? "DWH") as WorkloadCategory;
          const next = mutate((current) => {
            const id = nextWorkloadId(current.workloads);
            const workload = createDefaultWorkload(type, id, current.requirements.cloud, typeof input.name === "string" ? input.name : undefined);
            return { ...current, workloads: [...current.workloads, workload], activeWorkloadId: id };
          });
          return result({ updated: true, activeWorkloadId: next.activeWorkloadId, workloads: next.workloads, comparison: compareStrategies(next) });
        },
      },
      {
        name: "update_workload",
        title: "Update workload",
        description: "Update a workload's identity, category, compute, sizing, or chat/NLP requirement. Set naturalLanguageAnalytics=true when users ask natural-language questions over data so Genie-capable Serverless and Pro options are highlighted.",
        inputSchema: {
          type: "object",
          properties: { workloadId: { type: "string" }, ...workloadProperties },
          required: ["workloadId"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.workloadId !== "string") throw new Error("workloadId is required");
          const next = mutate((current) => updateWorkload(current, input.workloadId as string, (existing) => {
            const type = typeof input.type === "string" ? input.type as WorkloadCategory : existing.type;
            let workload = type === existing.type ? existing : changeWorkloadType(existing, type);
            if (input.naturalLanguageAnalytics === true && type !== "DWH") throw new Error("naturalLanguageAnalytics applies only to DWH workloads with Databricks Genie.");
            if (typeof input.computeId === "string") {
              if (!isComputeForWorkload(type, input.computeId)) throw new Error(`${input.computeId} is not valid for ${type}.`);
              workload = { ...workload, computeId: input.computeId };
            }
            if (typeof input.warehouseSize === "string" && !isWarehouseSize(input.warehouseSize)) throw new Error("Unknown warehouseSize.");
            const cloud = current.requirements.cloud;
            if (typeof input.driverInstance === "string" && !isInstanceForCloud(cloud, input.driverInstance)) throw new Error(`Unknown driver instance for ${cloud}.`);
            if (typeof input.workerInstance === "string" && !isInstanceForCloud(cloud, input.workerInstance)) throw new Error(`Unknown worker instance for ${cloud}.`);
            return {
              ...workload,
              ...(typeof input.name === "string" ? { name: input.name } : {}),
              ...(typeof input.naturalLanguageAnalytics === "boolean" ? { naturalLanguageAnalytics: input.naturalLanguageAnalytics } : {}),
              ...(typeof input.warehouseSize === "string" ? { warehouseSize: input.warehouseSize as WarehouseSize } : {}),
              ...(typeof input.driverInstance === "string" ? { driverInstance: input.driverInstance } : {}),
              ...(typeof input.workerInstance === "string" ? { workerInstance: input.workerInstance } : {}),
              ...(typeof input.workerCount === "number" ? { workerCount: input.workerCount } : {}),
              ...(typeof input.pipelines === "number" ? { pipelines: input.pipelines } : {}),
              ...(typeof input.serverlessDbuPerHour === "number" ? { serverlessDbuPerHour: input.serverlessDbuPerHour } : {}),
            };
          }));
          return result({ updated: true, workloads: next.workloads, comparison: compareStrategies(next) });
        },
      },
      {
        name: "remove_workload",
        title: "Remove workload",
        description: "Remove one workload from the project. The final remaining workload cannot be removed.",
        inputSchema: {
          type: "object",
          properties: { workloadId: { type: "string" } },
          required: ["workloadId"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.workloadId !== "string") throw new Error("workloadId is required");
          const next = mutate((current) => {
            if (current.workloads.length === 1) throw new Error("The final workload cannot be removed.");
            if (!current.workloads.some((workload) => workload.id === input.workloadId)) throw new Error(`Unknown workload: ${input.workloadId}`);
            const workloads = current.workloads.filter((workload) => workload.id !== input.workloadId);
            return {
              ...current,
              workloads,
              activeWorkloadId: current.activeWorkloadId === input.workloadId ? workloads[0].id : current.activeWorkloadId,
            };
          });
          return result({ updated: true, activeWorkloadId: next.activeWorkloadId, workloads: next.workloads, comparison: compareStrategies(next) });
        },
      },
      {
        name: "select_workload",
        title: "Select workload",
        description: "Choose which configured workload the UI and comparison field should focus on.",
        inputSchema: {
          type: "object",
          properties: { workloadId: { type: "string" } },
          required: ["workloadId"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.workloadId !== "string") throw new Error("workloadId is required");
          const next = mutate((current) => {
            if (!current.workloads.some((workload) => workload.id === input.workloadId)) throw new Error(`Unknown workload: ${input.workloadId}`);
            return { ...current, activeWorkloadId: input.workloadId as string };
          });
          return result({ updated: true, activeWorkloadId: next.activeWorkloadId, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_requirement",
        title: "Set project requirement",
        description: "Update the cloud or private-networking requirement. Changing cloud normalizes cluster instances and selects a valid region.",
        inputSchema: {
          type: "object",
          properties: {
            cloud: { type: "string", enum: ["AWS", "Azure", "GCP"] },
            privateNetworking: { type: "boolean" },
          },
          additionalProperties: false,
        },
        execute: (input) => {
          const next = mutate((current) => {
            const cloud = input.cloud ? input.cloud as Cloud : current.requirements.cloud;
            const cloudChanged = cloud !== current.requirements.cloud;
            return {
              ...current,
              requirements: {
                cloud,
                privateNetworking: typeof input.privateNetworking === "boolean" ? input.privateNetworking : current.requirements.privateNetworking,
              },
              assumptions: {
                region: cloudChanged ? REGIONS_BY_CLOUD[cloud][0].value : current.assumptions.region,
              },
              workloads: cloudChanged ? current.workloads.map((workload) => normalizeWorkloadForCloud(workload, cloud)) : current.workloads,
            };
          });
          return result({ updated: true, decision: next, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_region",
        title: "Set pricing region",
        description: "Set the provider-native region used for every workload's DBU and VM rates.",
        inputSchema: {
          type: "object",
          properties: { region: { type: "string" } },
          required: ["region"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.region !== "string") throw new Error("region is required");
          const next = mutate((current) => {
            if (!isRegionForCloud(current.requirements.cloud, input.region as string)) throw new Error(`Region ${input.region} is not available for ${current.requirements.cloud}.`);
            return { ...current, assumptions: { region: input.region as string } };
          });
          return result({ updated: true, region: next.assumptions.region, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_budget",
        title: "Set project budget",
        description: "Set the monthly USD budget applied to the complete project of configured workloads.",
        inputSchema: {
          type: "object",
          properties: { monthlyBudgetUsd: { type: "number", minimum: 1 } },
          required: ["monthlyBudgetUsd"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.monthlyBudgetUsd !== "number") throw new Error("monthlyBudgetUsd is required");
          const next = mutate((current) => ({ ...current, budget: input.monthlyBudgetUsd as number }));
          return result({ updated: true, budget: next.budget, comparison: compareStrategies(next) });
        },
      },
      {
        name: "update_project",
        title: "Update project",
        description: "Update the project name or switch the displayed cost period between monthly and annual.",
        inputSchema: {
          type: "object",
          properties: {
            projectName: { type: "string", minLength: 1, maxLength: 120 },
            costPeriod: { type: "string", enum: ["monthly", "annual"] },
          },
          additionalProperties: false,
        },
        execute: (input) => {
          const next = mutate((current) => {
            const projectName = typeof input.projectName === "string" ? input.projectName.trim() : current.projectName;
            if ("projectName" in input && !projectName) throw new Error("projectName cannot be empty");
            const costPeriod = input.costPeriod === "annual" || input.costPeriod === "monthly"
              ? input.costPeriod as CostPeriod
              : current.costPeriod;
            return { ...current, projectName, costPeriod };
          });
          return result({ updated: true, projectName: next.projectName, costPeriod: next.costPeriod, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_currency",
        title: "Set display currency",
        description: "Switch displayed budgets and estimates between USD and INR. Ranking remains in canonical USD.",
        inputSchema: {
          type: "object",
          properties: {
            currency: { type: "string", enum: ["USD", "INR"] },
            usdToInrRate: { type: "number", minimum: 1 },
          },
          required: ["currency"],
          additionalProperties: false,
        },
        execute: (input) => {
          const currency = input.currency as DisplayCurrency;
          if (currency !== "USD" && currency !== "INR") throw new Error("currency must be USD or INR");
          const next = mutate((current) => ({
            ...current,
            currency,
            usdToInrRate: typeof input.usdToInrRate === "number" ? input.usdToInrRate : current.usdToInrRate,
          }));
          return result({ updated: true, currency: next.currency, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_workload_schedule",
        title: "Set workload schedule",
        description: "Update runtime for one workload. Schedule affects cost but does not change workload category.",
        inputSchema: {
          type: "object",
          properties: {
            workloadId: { type: "string" },
            hoursPerDay: { type: "number", minimum: 1, maximum: 24 },
            daysPerMonth: { type: "number", minimum: 1, maximum: 31 },
          },
          required: ["workloadId"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.workloadId !== "string") throw new Error("workloadId is required");
          const next = mutate((current) => updateWorkload(current, input.workloadId as string, (workload) => ({
            ...workload,
            ...(typeof input.hoursPerDay === "number" ? { hoursPerDay: input.hoursPerDay } : {}),
            ...(typeof input.daysPerMonth === "number" ? { daysPerMonth: input.daysPerMonth } : {}),
          })));
          return result({ updated: true, workloads: next.workloads, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_dwh_sizing",
        title: "Set DWH sizing",
        description: "Set the warehouse size for a DWH workload.",
        inputSchema: {
          type: "object",
          properties: {
            workloadId: { type: "string" },
            warehouseSize: { type: "string", enum: WAREHOUSE_SIZES },
          },
          required: ["workloadId", "warehouseSize"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (typeof input.workloadId !== "string" || typeof input.warehouseSize !== "string" || !isWarehouseSize(input.warehouseSize)) throw new Error("A valid workloadId and warehouseSize are required.");
          const next = mutate((current) => updateWorkload(current, input.workloadId as string, (workload) => {
            if (workload.type !== "DWH") throw new Error("set_dwh_sizing only applies to DWH workloads.");
            return { ...workload, warehouseSize: input.warehouseSize as WarehouseSize };
          }));
          return result({ updated: true, workloads: next.workloads, comparison: compareStrategies(next) });
        },
      },
      {
        name: "get_pricing_options",
        title: "Get regional pricing options",
        description: "Inspect compute, sizing, DBU, and VM options for a workload category in the active cloud and region.",
        inputSchema: {
          type: "object",
          properties: { workloadType: { type: "string", enum: ["DWH", "ETL", "DEV"] } },
          required: ["workloadType"],
          additionalProperties: false,
        },
        execute: (input) => {
          const type = input.workloadType as WorkloadCategory;
          if (!["DWH", "ETL", "DEV"].includes(type)) throw new Error("workloadType is required");
          return result(getPricingOptions(decisionRef.current.requirements.cloud, decisionRef.current.assumptions.region, type));
        },
      },
      {
        name: "compare_strategies",
        title: "Compare active workload options",
        description: "Compare category-valid compute options for the selected workload against technical requirements and total project budget.",
        execute: () => result(compareStrategies(decisionRef.current)),
      },
      {
        name: "get_cost_estimates",
        title: "Get project cost estimates",
        description: "Return configured monthly pricing components for every workload and the total project.",
        execute: () => result({
          cloud: decisionRef.current.requirements.cloud,
          region: decisionRef.current.assumptions.region,
          workloads: decisionRef.current.workloads.map((workload) => ({
            workload,
            costBreakdown: calculateWorkloadCost(workload, decisionRef.current),
          })),
          // Keep the old key as a compatibility alias for existing agents.
          estimatedProjectMonthlyCostUsd: estimatePortfolioCost(decisionRef.current),
          estimatedPortfolioMonthlyCostUsd: estimatePortfolioCost(decisionRef.current),
          disclaimer: "Planning list rates; taxes, disks, data transfer, and reserved-pricing discounts are excluded.",
        }),
      },
      {
        name: "get_recommendation",
        title: "Get active workload recommendation",
        description: "Return the best compute option for the active workload that satisfies technical constraints and total project budget.",
        execute: () => {
          const comparison = compareStrategies(decisionRef.current);
          return result({ activeWorkload: comparison.activeWorkload, recommendation: comparison.recommendation, summary: comparison.summary });
        },
      },
    ];

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })))
      .then(() => {
        setAvailableTools(tools.map(({ name, title, description }) => ({ name, title, description })));
        setConnection("connected");
      })
      .catch(() => setConnection("unavailable"));

    return () => controller.abort();
  }, []);

  return { connection, tools: availableTools };
}
