# WebMCP integration

StrategyShifu registers browser-native tools through document.modelContext.registerTool(). An AbortController owns the registration lifecycle.

All mutations update the same DecisionState rendered by React and return fresh deterministic project output.

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
