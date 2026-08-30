"use client";

import { useEffect, useRef, useState } from "react";
import { compareStrategies } from "@/lib/decision-engine";
import { isRegionForCloud, REGIONS_BY_CLOUD } from "@/lib/regions";
import type { Cloud, DecisionState, WorkloadType } from "@/lib/types";

type ConnectionState = "checking" | "connected" | "unavailable";

function result(payload: unknown): WebMCPToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export function useWebMCP(
  decision: DecisionState,
  onDecisionChange: (next: DecisionState) => void,
): ConnectionState {
  const decisionRef = useRef(decision);
  const changeRef = useRef(onDecisionChange);
  const [connection, setConnection] = useState<ConnectionState>("checking");

  useEffect(() => {
    decisionRef.current = decision;
  }, [decision]);

  useEffect(() => {
    changeRef.current = onDecisionChange;
  }, [onDecisionChange]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setConnection("unavailable");
      return;
    }

    const controller = new AbortController();
    const mutate = (update: (current: DecisionState) => DecisionState) => {
      const next = update(decisionRef.current);
      decisionRef.current = next;
      changeRef.current(next);
      return next;
    };

    const tools: WebMCPTool[] = [
      {
        name: "get_decision_state",
        title: "Get decision state",
        description: "Read the complete StrategyShifu workload, requirements, budget, assumptions, and current recommendation.",
        execute: () => result({ decision: decisionRef.current, comparison: compareStrategies(decisionRef.current) }),
      },
      {
        name: "set_workload",
        title: "Set workload",
        description: "Update one or more high-level workload attributes and immediately recompute the shared decision.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["streaming", "batch"] },
            description: { type: "string" },
            dataVolumeGbPerDay: { type: "number", minimum: 1 },
            slaMinutes: { type: "number", minimum: 1 },
          },
          additionalProperties: false,
        },
        execute: (input) => {
          const next = mutate((current) => ({
            ...current,
            workload: {
              ...current.workload,
              ...(input.type ? { type: input.type as WorkloadType } : {}),
              ...(typeof input.description === "string" ? { description: input.description } : {}),
              ...(typeof input.dataVolumeGbPerDay === "number" ? { dataVolumeGbPerDay: input.dataVolumeGbPerDay } : {}),
              ...(typeof input.slaMinutes === "number" ? { slaMinutes: input.slaMinutes } : {}),
            },
          }));
          return result({ updated: true, decision: next, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_requirement",
        title: "Set technical requirement",
        description: "Update cloud or private networking requirements and recompute technical compatibility.",
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
            const cloud = input.cloud ? (input.cloud as Cloud) : current.requirements.cloud;
            const nextRegion = isRegionForCloud(cloud, current.assumptions.region)
              ? current.assumptions.region
              : REGIONS_BY_CLOUD[cloud][0].value;
            return {
              ...current,
              requirements: {
                ...current.requirements,
                ...(input.cloud ? { cloud } : {}),
                ...(typeof input.privateNetworking === "boolean" ? { privateNetworking: input.privateNetworking } : {}),
              },
              assumptions: { ...current.assumptions, region: nextRegion },
            };
          });
          return result({ updated: true, decision: next, comparison: compareStrategies(next) });
        },
      },
      {
        name: "set_budget",
        title: "Set monthly budget",
        description: "Set the monthly USD budget and immediately reconsider all technically valid strategies.",
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
        name: "set_assumption",
        title: "Set cost assumption",
        description: "Update schedule, region, or worker scale assumptions used by every cost estimate.",
        inputSchema: {
          type: "object",
          properties: {
            hoursPerDay: { type: "number", minimum: 1, maximum: 24 },
            daysPerMonth: { type: "number", minimum: 1, maximum: 31 },
            region: { type: "string" },
            workerScale: { type: "number", minimum: 0.5, maximum: 4 },
          },
          additionalProperties: false,
        },
        execute: (input) => {
          const next = mutate((current) => {
            if (typeof input.region === "string" && !isRegionForCloud(current.requirements.cloud, input.region)) {
              throw new Error(`Region ${input.region} is not available for ${current.requirements.cloud}.`);
            }
            return {
              ...current,
              assumptions: {
                ...current.assumptions,
                ...(typeof input.hoursPerDay === "number" ? { hoursPerDay: input.hoursPerDay } : {}),
                ...(typeof input.daysPerMonth === "number" ? { daysPerMonth: input.daysPerMonth } : {}),
                ...(typeof input.region === "string" ? { region: input.region } : {}),
                ...(typeof input.workerScale === "number" ? { workerScale: input.workerScale } : {}),
              },
            };
          });
          return result({ updated: true, assumptions: next.assumptions, comparison: compareStrategies(next) });
        },
      },
      {
        name: "compare_strategies",
        title: "Compare strategies",
        description: "Evaluate technical fit first, then budget fit, cost efficiency, and operational simplicity for all strategies.",
        execute: () => result(compareStrategies(decisionRef.current)),
      },
      {
        name: "get_cost_estimates",
        title: "Get cost estimates",
        description: "Return transparent monthly estimates for all strategies with the assumptions used.",
        execute: () => {
          const comparison = compareStrategies(decisionRef.current);
          return result({
            assumptions: decisionRef.current.assumptions,
            workloadVolumeGbPerDay: decisionRef.current.workload.dataVolumeGbPerDay,
            estimates: comparison.evaluations.map(({ strategy, estimatedCost }) => ({
              strategyId: strategy.id,
              strategy: strategy.name,
              estimatedMonthlyCostUsd: estimatedCost,
            })),
            disclaimer: "Reference demo pricing; not a live Databricks quote.",
          });
        },
      },
      {
        name: "get_recommendation",
        title: "Get recommendation",
        description: "Return the best strategy that satisfies hard technical constraints and the current monthly budget.",
        execute: () => {
          const comparison = compareStrategies(decisionRef.current);
          return result({ recommendation: comparison.recommendation, summary: comparison.summary });
        },
      },
    ];

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })))
      .then(() => setConnection("connected"))
      .catch(() => setConnection("unavailable"));

    return () => controller.abort();
  }, []);

  return connection;
}
