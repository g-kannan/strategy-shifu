import { calculateWorkloadCost } from "./pricing";
import { getStrategiesForWorkload } from "./strategies";
import type {
  ComparisonResult,
  DecisionState,
  DisplayCurrency,
  Evaluation,
  StrategyDefinition,
  Workload,
} from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function getActiveWorkload(decision: DecisionState): Workload {
  return decision.workloads.find((workload) => workload.id === decision.activeWorkloadId)
    ?? decision.workloads[0];
}

export function estimatePortfolioCost(decision: DecisionState): number {
  return Math.round(decision.workloads.reduce(
    (total, workload) => total + calculateWorkloadCost(workload, decision).totalMonthlyCost,
    0,
  ));
}

function evaluateStrategy(
  strategy: StrategyDefinition,
  activeWorkload: Workload,
  otherWorkloadsCost: number,
  decision: DecisionState,
): Evaluation {
  const failedRequirements: string[] = [];
  if (decision.requirements.privateNetworking) {
    if (!strategy.supportsPrivateNetworking) {
      failedRequirements.push("Private networking is not supported by this compute option in the planning model.");
    }
    const incompatibleWorkloads = decision.workloads
      .filter((workload) => workload.id !== activeWorkload.id)
      .filter((workload) => !getStrategiesForWorkload(workload.type)
        .find((candidate) => candidate.id === workload.computeId)?.supportsPrivateNetworking);
    if (incompatibleWorkloads.length > 0) {
      failedRequirements.push(
        `Configured workload${incompatibleWorkloads.length === 1 ? "" : "s"} ${incompatibleWorkloads.map((workload) => workload.name).join(", ")} must use private-network-compatible compute.`,
      );
    }
  }

  const costBreakdown = calculateWorkloadCost(activeWorkload, decision, strategy.id);
  const workloadCost = Math.round(costBreakdown.totalMonthlyCost);
  const estimatedCost = Math.round(otherWorkloadsCost + costBreakdown.totalMonthlyCost);
  const technicalFit = failedRequirements.length === 0;
  const budgetFit = estimatedCost <= decision.budget;
  const costEfficiency = Math.max(0, 24 - (estimatedCost / Math.max(decision.budget, 1)) * 16);
  const score = Math.round(
    (technicalFit ? 40 : 0) +
      (budgetFit ? 20 : 0) +
      costEfficiency +
      strategy.operationalScore,
  );

  const reasoning = technicalFit
    ? [
        `Supports the ${activeWorkload.type} workload configuration.`,
        budgetFit
          ? `${formatCurrency(decision.budget - estimatedCost, decision.currency, decision.usdToInrRate)} remains in the project budget.`
          : `${formatCurrency(estimatedCost - decision.budget, decision.currency, decision.usdToInrRate)} over the project budget.`,
      ]
    : failedRequirements;

  return {
    strategy,
    workloadCost,
    otherWorkloadsCost: Math.round(otherWorkloadsCost),
    estimatedCost,
    costBreakdown,
    technicalFit,
    budgetFit,
    failedRequirements,
    score,
    reasoning,
    recommended: false,
    configured: strategy.id === activeWorkload.computeId,
  };
}

export function compareStrategies(decision: DecisionState): ComparisonResult {
  const activeWorkload = getActiveWorkload(decision);
  const otherWorkloadsCost = decision.workloads
    .filter((workload) => workload.id !== activeWorkload.id)
    .reduce((total, workload) => total + calculateWorkloadCost(workload, decision).totalMonthlyCost, 0);
  const currentPortfolioCost = estimatePortfolioCost(decision);
  const evaluations = getStrategiesForWorkload(activeWorkload.type)
    .map((strategy) => evaluateStrategy(strategy, activeWorkload, otherWorkloadsCost, decision))
    .sort(
      (a, b) =>
        Number(b.technicalFit) - Number(a.technicalFit) ||
        Number(b.budgetFit) - Number(a.budgetFit) ||
        b.score - a.score ||
        a.estimatedCost - b.estimatedCost,
    );
  const winner = evaluations
    .filter((item) => item.technicalFit && item.budgetFit)
    .sort((a, b) => b.score - a.score || a.estimatedCost - b.estimatedCost)[0] ?? null;

  if (winner) winner.recommended = true;

  return {
    activeWorkload,
    evaluations,
    recommendation: winner,
    currentPortfolioCost,
    summary: winner
      ? `${winner.strategy.shortName} is the strongest option for ${activeWorkload.name} within the ${formatCurrency(decision.budget, decision.currency, decision.usdToInrRate)} project budget.`
      : `No technically valid option for ${activeWorkload.name} fits the current project budget.`,
  };
}

export function formatCurrency(value: number, displayCurrency: DisplayCurrency = "USD", usdToInrRate = 95): string {
  if (displayCurrency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value * usdToInrRate);
  }
  return currency.format(value);
}

export function formatHourlyRate(value: number, displayCurrency: DisplayCurrency = "USD", usdToInrRate = 95): string {
  return new Intl.NumberFormat(displayCurrency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value * (displayCurrency === "INR" ? usdToInrRate : 1));
}
