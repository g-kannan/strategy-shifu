# WebMCP integration

StrategyShifu registers browser-native tools through document.modelContext.registerTool(). An AbortController owns the registration lifecycle.

All mutations update the same DecisionState rendered by React and return fresh deterministic project output.

## Tool strategy

The user goal is a reviewable Databricks cost or migration decision, not autonomous execution of infrastructure changes. The initial state is the currently visible project or migration form, including the active workload and every constraint already supplied by the person. WebMCP tools can inspect and revise that planning state, but cannot provision resources, purchase services, or approve a production migration.

Typical agent journeys are intentionally flexible:

1. Read the current assessment and identify missing or conflicting constraints.
2. Ask the person for material information that is not present instead of guessing it.
3. Apply confirmed inputs to the shared workspace.
4. Compare options and explain the deterministic recommendation, failed gates, risks, and assumptions.
5. Leave the final decision with the person, visible in the same UI.

Tool descriptions and schemas describe single-purpose operations so an agent can select only the capabilities needed for a journey.

## Reliability and security

- Inputs are validated in executable code as well as described by JSON Schema. Invalid values return field-specific recovery guidance and do not mutate visible state.
- Mutations update the same React state used by the human controls before returning the recalculated decision result.
- Read-only tools carry `readOnlyHint`. Tools that return user-entered planning text or current external documentation carry `untrustedContentHint`.
- Registrations are scoped to the page lifecycle with an AbortSignal. If a browser rejects one tool, successfully registered tools remain available; if it rejects every tool, the human workflow remains usable.
- The integration uses the maintained `webmcp-types` package while still feature-detecting `document.modelContext`, because WebMCP is experimental and unsupported browsers must retain the complete UI workflow.

## Workload operations

### list_workloads

Returns all workloads and the active workload ID.

### add_workload

~~~json
{
  "name": "Daily ingestion",
  "type": "ETL"
}
~~~

Category defaults choose an appropriate compute and schedule. The new workload becomes active.

### update_workload

All update fields are optional after workloadId. Category changes reset compute to a valid default.

~~~json
{
  "workloadId": "workload-2",
  "computeId": "jobs-classic",
  "driverInstance": "m6i.xlarge",
  "workerInstance": "m6i.2xlarge",
  "workerCount": 3,
  "pipelines": 2
}
~~~

For a DWH workload, set `naturalLanguageAnalytics` to `true` when the user asks for chat-based or NLP questions over data. The decision UI then highlights Databricks Genie and restricts eligible SQL warehouse options to Serverless and Pro.

~~~json
{
  "workloadId": "workload-1",
  "naturalLanguageAnalytics": true
}
~~~

### remove_workload

~~~json
{ "workloadId": "workload-2" }
~~~

The final workload cannot be removed.

### select_workload

~~~json
{ "workloadId": "workload-1" }
~~~

### set_workload_schedule

Schedule affects only the named workload's runtime cost.

~~~json
{
  "workloadId": "workload-2",
  "hoursPerDay": 3,
  "daysPerMonth": 30
}
~~~

### set_dwh_sizing

~~~json
{
  "workloadId": "workload-1",
  "warehouseSize": "Small"
}
~~~

## Project operations

### set_requirement

~~~json
{
  "cloud": "Azure",
  "privateNetworking": true
}
~~~

Changing cloud selects a valid region and normalizes cluster instance IDs.

### set_region

~~~json
{ "region": "centralindia" }
~~~

### set_budget

~~~json
{ "monthlyBudgetUsd": 5000 }
~~~

### update_project

~~~json
{
  "projectName": "Analytics platform",
  "costPeriod": "annual"
}
~~~

`costPeriod` changes display only. Pricing and recommendation gates remain based on the canonical monthly budget and monthly workload estimates.

### set_currency

~~~json
{
  "currency": "INR",
  "usdToInrRate": 95
}
~~~

## Read and evaluation operations

- get_decision_state returns complete state and the active comparison.
- get_pricing_options returns compute, sizing, DBU, and VM options for DWH, ETL, or DEV in the active region.
- compare_strategies compares category-valid compute for the active workload while holding other workload costs fixed.
- get_cost_estimates returns configured cost components for every workload plus the project total. Its canonical aggregate field is `estimatedProjectMonthlyCostUsd`; `estimatedPortfolioMonthlyCostUsd` remains as a compatibility alias for existing agents.
- get_recommendation returns the best active-workload option passing networking and project-budget gates.

## Browser support

WebMCP remains an emerging browser API. StrategyShifu feature-detects document.modelContext; unsupported browsers keep the complete human workflow.
