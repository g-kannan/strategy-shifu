import { STRATEGIES } from "./strategies";
import type { ComparisonResult, DecisionState, Evaluation, StrategyDefinition } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function estimateCost(strategy: StrategyDefinition, decision: DecisionState): number {
  const { hoursPerDay, daysPerMonth, workerScale } = decision.assumptions;
  const monthlyHours = hoursPerDay * daysPerMonth;
  const monthlyVolume = decision.workload.dataVolumeGbPerDay * daysPerMonth;
  const workloadFactor = decision.workload.type === "streaming" ? 1 : 0.74;

  return Math.round(
    strategy.baseMonthlyCost +
      monthlyHours * strategy.computeRate * workerScale * workloadFactor +
      monthlyVolume * strategy.volumeRate * workerScale,
  );
}

function evaluateStrategy(strategy: StrategyDefinition, decision: DecisionState): Evaluation {
  const failedRequirements: string[] = [];

  if (!strategy.supports.includes(decision.workload.type)) {
    failedRequirements.push(`Does not support ${decision.workload.type} workloads.`);
  }
  if (decision.requirements.privateNetworking && !strategy.supportsPrivateNetworking) {
    failedRequirements.push("Private networking is not supported by the configured strategy assumptions.");
  }
  if (decision.workload.slaMinutes < strategy.minimumSlaMinutes) {
    failedRequirements.push(
      `The ${decision.workload.slaMinutes}-minute SLA is below this strategy's ${strategy.minimumSlaMinutes}-minute operating threshold.`,
    );
  }

  const estimatedCost = estimateCost(strategy, decision);
  const technicalFit = failedRequirements.length === 0;
  const budgetFit = estimatedCost <= decision.budget;
  const costEfficiency = Math.max(0, 24 - (estimatedCost / Math.max(decision.budget, 1)) * 16);
  const workloadBonus =
    decision.workload.type === "streaming"
      ? strategy.id.includes("classic") || strategy.id.includes("serverless")
        ? 22
        : 10
      : strategy.id.includes("serverless")
        ? 24
        : strategy.id.includes("jobs")
          ? 21
          : 16;
  const score = Math.round(
    (technicalFit ? 40 : 0) +
      (budgetFit ? 20 : 0) +
      costEfficiency +
      strategy.operationalScore +
      workloadBonus,
  );

  const reasoning: string[] = [];
  if (technicalFit) {
    reasoning.push(`Supports the ${decision.workload.type} workload and ${decision.workload.slaMinutes}-minute SLA.`);
    if (decision.requirements.privateNetworking) reasoning.push("Meets the private networking requirement.");
  } else {
    reasoning.push(...failedRequirements);
  }
  reasoning.push(
    budgetFit
      ? `${currency.format(decision.budget - estimatedCost)} remains in the monthly budget.`
      : `${currency.format(estimatedCost - decision.budget)} over the monthly budget.`,
  );

  return {
    strategy,
    estimatedCost,
    technicalFit,
    budgetFit,
    failedRequirements,
    score,
    reasoning,
    recommended: false,
  };
}

export function compareStrategies(decision: DecisionState): ComparisonResult {
  const evaluations = STRATEGIES.map((strategy) => evaluateStrategy(strategy, decision)).sort(
    (a, b) =>
      Number(b.technicalFit) - Number(a.technicalFit) ||
      Number(b.budgetFit) - Number(a.budgetFit) ||
      b.score - a.score ||
      a.estimatedCost - b.estimatedCost,
  );
  const eligible = evaluations
    .filter((item) => item.technicalFit && item.budgetFit)
    .sort((a, b) => b.score - a.score || a.estimatedCost - b.estimatedCost);
  const winner = eligible[0] ?? null;

  if (winner) winner.recommended = true;

  return {
    evaluations,
    recommendation: winner,
    summary: winner
      ? `${winner.strategy.shortName} is the strongest technically valid option within the ${currency.format(decision.budget)} budget.`
      : "No technically valid strategy fits the current budget. Adjust the budget or workload assumptions to continue.",
  };
}

export function formatCurrency(value: number): string {
  return currency.format(value);
}
