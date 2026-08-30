# WebMCP integration

StrategyShifu registers browser-native tools through `document.modelContext.registerTool()`. An `AbortController` owns the registration lifecycle, so navigating away cleanly unregisters the page's tools.

All mutating operations update the same `DecisionState` used by the visible React controls, then synchronously return a fresh deterministic comparison.

## Mutation schemas

### `set_workload`

All fields are optional; provide at least the fields that should change.

```json
{
  "type": "streaming | batch",
  "description": "string",
  "dataVolumeGbPerDay": 300,
  "slaMinutes": 5
}
```

### `set_requirement`

```json
{
  "cloud": "AWS | Azure | GCP",
  "privateNetworking": true
}
```

### `set_budget`

```json
{ "monthlyBudgetUsd": 1500 }
```

### `set_assumption`

```json
{
  "hoursPerDay": 8,
  "daysPerMonth": 22,
  "region": "us-east-1",
  "workerScale": 1
}
```

## Read and evaluation operations

- `get_decision_state` returns the complete state and comparison.
- `compare_strategies` returns all evaluations and the eligible winner.
- `get_cost_estimates` returns assumptions, monthly estimates, and a pricing disclaimer.
- `get_recommendation` returns the winner and concise summary, or `null` when no strategy passes both gates.

## Browser support

WebMCP remains an emerging browser API. StrategyShifu feature-detects `document.modelContext`; unsupported browsers keep the complete human UI. Use a WebMCP-enabled browser or compatible browser-agent environment to discover and call the tools.
