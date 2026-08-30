"use client";

import { useCallback, useMemo, useState } from "react";
import { useWebMCP } from "@/hooks/use-webmcp";
import { compareStrategies, formatCurrency, formatHourlyRate, getActiveWorkload } from "@/lib/decision-engine";
import {
  calculateWorkloadCost,
  getInstancesForCloud,
  getPricingOptions,
  getPricingSource,
  getWarehouse,
  getWorkloadComputeOptions,
  WAREHOUSES,
  VM_PRICING_REFRESHED_AT,
  WORKLOAD_CATEGORIES,
} from "@/lib/pricing";
import { MIXED_PRESET, PRIMARY_DWH_PRESET } from "@/lib/presets";
import { REGIONS_BY_CLOUD } from "@/lib/regions";
import type {
  Cloud,
  CostPeriod,
  ComputeId,
  DecisionState,
  DisplayCurrency,
  Evaluation,
  WarehouseSize,
  Workload,
  WorkloadCategory,
} from "@/lib/types";
import {
  changeWorkloadType,
  createDefaultWorkload,
  nextWorkloadId,
  normalizeWorkloadForCloud,
} from "@/lib/workloads";
import { ArrowUpRight, Check, ChevronDown, Clock, Close, Network, Refresh, Spark } from "./icons";

type ScheduleView = "monthly" | "weekly";

export function DecisionWorkspace() {
  const [decision, setDecision] = useState<DecisionState>(PRIMARY_DWH_PRESET);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("monthly");
  const [scenarioMenu, setScenarioMenu] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const onDecisionChange = useCallback((next: DecisionState) => setDecision(next), []);
  const { connection, tools } = useWebMCP(decision, onDecisionChange);
  const comparison = useMemo(() => compareStrategies(decision), [decision]);
  const activeWorkload = getActiveWorkload(decision);
  const pricingSource = getPricingSource(decision.requirements.cloud);
  const computeOptions = getWorkloadComputeOptions(activeWorkload.type);
  const instances = getInstancesForCloud(decision.requirements.cloud);
  const regionalPricing = getPricingOptions(
    decision.requirements.cloud,
    decision.assumptions.region,
    activeWorkload.type,
  );
  const configuredBreakdown = calculateWorkloadCost(activeWorkload, decision);

  const updateActiveWorkload = (update: (workload: Workload) => Workload) =>
    setDecision((current) => ({
      ...current,
      workloads: current.workloads.map((workload) =>
        workload.id === current.activeWorkloadId ? update(workload) : workload,
      ),
    }));

  const setWorkload = <K extends keyof Workload>(key: K, value: Workload[K]) =>
    updateActiveWorkload((workload) => ({ ...workload, [key]: value }));

  const addWorkload = () =>
    setDecision((current) => {
      const id = nextWorkloadId(current.workloads);
      const workload = createDefaultWorkload("DWH", id, current.requirements.cloud);
      return { ...current, workloads: [...current.workloads, workload], activeWorkloadId: id };
    });

  const removeWorkload = (id: string) =>
    setDecision((current) => {
      if (current.workloads.length === 1) return current;
      const workloads = current.workloads.filter((workload) => workload.id !== id);
      return {
        ...current,
        workloads,
        activeWorkloadId: current.activeWorkloadId === id ? workloads[0].id : current.activeWorkloadId,
      };
    });

  const setCloud = (cloud: Cloud) =>
    setDecision((current) => ({
      ...current,
      requirements: { ...current.requirements, cloud },
      assumptions: { region: REGIONS_BY_CLOUD[cloud][0].value },
      workloads: current.workloads.map((workload) => normalizeWorkloadForCloud(workload, cloud)),
    }));

  const loadScenario = (scenario: DecisionState) => {
    setDecision(structuredClone(scenario));
    setScenarioMenu(false);
  };

  const periodMultiplier = decision.costPeriod === "annual" ? 12 : 1;
  const periodLabel = decision.costPeriod === "annual" ? "ANNUAL" : "MONTHLY";
  const displayBudget = decision.budget * periodMultiplier * (decision.currency === "INR" ? decision.usdToInrRate : 1);
  const displayProjectCost = comparison.currentPortfolioCost * periodMultiplier;
  const displayProjectBudget = decision.budget * periodMultiplier;
  const selectedWarehouse = activeWorkload.type === "DWH" ? getWarehouse(activeWorkload.warehouseSize) : null;
  const isServerless = activeWorkload.computeId === "serverless-sql" || activeWorkload.computeId === "jobs-serverless";

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="StrategyShifu home">
          <span className="brand-lockup">
            <span className="brand-wordmark"><span>Strategy</span><b>Shifu</b></span>
            <small>Decide with your agent.</small>
          </span>
        </a>
        <div className="header-center">
          <nav className="page-nav" aria-label="Primary navigation">
            <a className="active" href="/" aria-current="page">Databricks</a>
            <a href="/compute-guide">Compute Guide</a>
          </nav>
          <nav className="process-nav" aria-label="Decision progress">
            <span className="process-step done"><i><Check /></i> Workloads</span>
            <span className="process-line" />
            <span className="process-step done"><i><Check /></i> Price</span>
            <span className="process-line" />
            <span className="process-step active"><i>03</i> Decide</span>
          </nav>
        </div>
        <div className="agent-status-wrap">
          <button
            className={`agent-status ${connection}`}
            title={connection === "connected" ? "View the tools available to browser agents." : "WebMCP tools are not available in this browser."}
            aria-label="WebMCP Tools"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((open) => !open)}
          >
            <span /> WebMCP Tools
          </button>
          {toolsOpen && (
            <div className="tools-popover" role="dialog" aria-label="WebMCP Tools available">
              <div className="tools-popover-heading">
                <div><p className="section-index">BROWSER CAPABILITIES</p><h2>WebMCP Tools</h2></div>
                <span>{connection === "connected" ? `${tools.length} available` : "Unavailable"}</span>
              </div>
              {connection === "connected" ? (
                <div className="tool-list">
                  {tools.map((tool) => (
                    <div className="tool-item" key={tool.name}>
                      <code>{tool.name}</code>
                      <p>{tool.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tools-empty">This browser does not expose <code>document.modelContext</code>. The workspace remains fully usable.</p>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <p className="eyebrow">TECHNICAL DECISION / DATABRICKS</p>
          <h1>Find the right strategy.</h1>
          <div className="hero-subrow">
            <div>
              <p className="hero-copy">Compare technical fit, current pricing and budget for your workload.</p>
              <div className="decision-framework" aria-label="Decision framework">
                <span>FIT</span><i>→</i><span>COST</span><i>→</i><span>BUDGET</span><i>→</i><b>DECIDE</b>
              </div>
            </div>
            <div className="scenario-wrap">
              <button className="scenario-button" onClick={() => setScenarioMenu((open) => !open)} aria-expanded={scenarioMenu}>
                <Spark /> Load example <ChevronDown />
              </button>
              {scenarioMenu && (
                <div className="scenario-menu">
                  <button onClick={() => loadScenario(PRIMARY_DWH_PRESET)}>
                    <span>DataWarehouse</span><small>24×7 · private network</small>
                  </button>
                  <button onClick={() => loadScenario(MIXED_PRESET)}>
                    <span>DWH + ETL project</span><small>Two independently scheduled workloads</small>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="project-overview" aria-label="Project overview">
        <div className="project-overview-heading">
          <div className="project-name-field">
            <label className="section-index" htmlFor="project-name">PROJECT NAME</label>
            <input
              id="project-name"
              value={decision.projectName}
              onChange={(event) => setDecision((current) => ({ ...current, projectName: event.target.value }))}
              placeholder="Untitled project"
            />
          </div>
          <div className="project-period-control">
            <span className="section-index">COST PERIOD</span>
            <div className="period-toggle" role="group" aria-label="Cost period">
              {(["monthly", "annual"] as CostPeriod[]).map((period) => (
                <button
                  key={period}
                  className={decision.costPeriod === period ? "selected" : ""}
                  onClick={() => setDecision((current) => ({ ...current, costPeriod: period }))}
                >
                  {period === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="project-overview-total">
          <div>
            <p className="section-index">ESTIMATED {periodLabel} TOTAL</p>
            <strong>{formatCurrency(displayProjectCost, decision.currency, decision.usdToInrRate)}</strong>
            <span>{decision.workloads.length} configured workload{decision.workloads.length === 1 ? "" : "s"} · {periodLabel === "ANNUAL" ? "annualized from monthly estimates" : "all workload estimates combined"}</span>
          </div>
          <div className="project-overview-meta">
            <span><b>Project budget</b>{formatCurrency(displayProjectBudget, decision.currency, decision.usdToInrRate)} / {decision.costPeriod === "annual" ? "year" : "month"}</span>
            <span><b>Cloud</b>{decision.requirements.cloud}</span>
            <span><b>Region</b>{decision.assumptions.region}</span>
          </div>
        </div>
        <div className="project-workload-summary" aria-label="Project workload costs">
          {decision.workloads.map((workload) => {
            const cost = calculateWorkloadCost(workload, decision).totalMonthlyCost * periodMultiplier;
            const compute = getWorkloadComputeOptions(workload.type).find((option) => option.id === workload.computeId)?.label ?? workload.computeId;
            return (
              <button
                key={workload.id}
                className={`project-workload-card ${workload.id === activeWorkload.id ? "active" : ""}`}
                onClick={() => setDecision((current) => ({ ...current, activeWorkloadId: workload.id }))}
              >
                <span className="project-workload-card-top"><b>{workload.type}</b><small>{workload.id === activeWorkload.id ? "Editing" : "Select"}</small></span>
                <strong>{workload.name}</strong>
                <span className="project-workload-cost">{formatCurrency(cost, decision.currency, decision.usdToInrRate)} <small>/ {decision.costPeriod === "annual" ? "year" : "month"}</small></span>
                <span className="project-workload-detail">{compute} · {workload.hoursPerDay} hrs/day</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="workspace" aria-label="Technical decision workspace">
        <aside className="input-panel">
          <div className="panel-heading workload-heading">
            <div><p className="section-index">01 / WORKLOADS</p><h2>What are you running?</h2></div>
            <button className="add-workload" onClick={addWorkload}>+ Add</button>
          </div>

          <div className="workload-list" aria-label="Configured workloads">
            {decision.workloads.map((workload) => (
              <div key={workload.id} className={`workload-item ${workload.id === activeWorkload.id ? "active" : ""}`}>
                <button
                  className="workload-select"
                  onClick={() => setDecision((current) => ({ ...current, activeWorkloadId: workload.id }))}
                >
                  <span>{workload.type}</span>
                  <span><b>{workload.name}</b><small>{getWorkloadComputeOptions(workload.type).find((option) => option.id === workload.computeId)?.label}</small></span>
                </button>
                {decision.workloads.length > 1 && (
                  <button
                    className="workload-remove"
                    aria-label={`Remove ${workload.name}`}
                    onClick={() => removeWorkload(workload.id)}
                  >×</button>
                )}
              </div>
            ))}
          </div>

          <p className="editing-note">Editing <b>{activeWorkload.name}</b>. Schedule is configured separately below.</p>

          <div className="form-section">
            <label className="field-label" htmlFor="workload-name">Workload name</label>
            <div className="number-field">
              <input id="workload-name" value={activeWorkload.name} onChange={(event) => setWorkload("name", event.target.value)} />
            </div>
          </div>

          <div className="field-grid">
            <div className="form-section">
              <label className="field-label" htmlFor="workload-type">Workload type</label>
              <div className="select-field">
                <select
                  id="workload-type"
                  value={activeWorkload.type}
                  onChange={(event) => updateActiveWorkload((workload) => changeWorkloadType(workload, event.target.value as WorkloadCategory))}
                >
                  {WORKLOAD_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.id} · {category.label}</option>)}
                </select>
                <ChevronDown />
              </div>
            </div>
            <div className="form-section">
              <label className="field-label" htmlFor="compute-type">Compute type</label>
              <div className="select-field">
                <select id="compute-type" value={activeWorkload.computeId} onChange={(event) => setWorkload("computeId", event.target.value as ComputeId)}>
                  {computeOptions.map((option) => {
                    const rate = regionalPricing.computeRates.find((candidate) => candidate.computeId === option.id);
                    return <option key={option.id} value={option.id}>{option.label}{rate ? ` · $${rate.ratePerDbu}/DBU` : ""}</option>;
                  })}
                </select>
                <ChevronDown />
              </div>
            </div>
          </div>

          {activeWorkload.type === "DWH" && selectedWarehouse && (
            <div className="form-section warehouse-sizing">
              <div className="field-label-row">
                <label className="field-label" htmlFor="warehouse-size">Warehouse size</label>
                <span>{isServerless ? "INFRA INCLUDED" : "DBU + VM"}</span>
              </div>
              <div className="select-field">
                <select id="warehouse-size" value={activeWorkload.warehouseSize} onChange={(event) => setWorkload("warehouseSize", event.target.value as WarehouseSize)}>
                  {WAREHOUSES.map((warehouse) => {
                    const optionCost = calculateWorkloadCost({ ...activeWorkload, warehouseSize: warehouse.size }, decision);
                    return (
                      <option key={warehouse.size} value={warehouse.size}>
                        {warehouse.size} · {warehouse.dbuPerHour} DBU/h · {isServerless ? "infra included" : `$${optionCost.totalHourlyRate}/h total`}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown />
              </div>
              <div className="warehouse-specs">
                <span><b>{selectedWarehouse.dbuPerHour}</b> DBU / H</span>
                <span><b>{selectedWarehouse.workers}</b> WORKER{selectedWarehouse.workers === 1 ? "" : "S"}</span>
                <span><b>{selectedWarehouse.vcpu}</b> VCPU</span>
                <span><b>{selectedWarehouse.memoryGiB}</b> GIB</span>
              </div>
            </div>
          )}

          {activeWorkload.type === "ETL" && activeWorkload.computeId === "jobs-serverless" && (
            <div className="field-grid">
              <NumberInput label="Serverless DBU / hour" value={activeWorkload.serverlessDbuPerHour} min={0.01} step={0.25} onChange={(value) => setWorkload("serverlessDbuPerHour", value)} />
              <NumberInput label="Pipelines" value={activeWorkload.pipelines} min={1} onChange={(value) => setWorkload("pipelines", value)} />
            </div>
          )}

          {(activeWorkload.computeId === "jobs-classic" || activeWorkload.computeId === "all-purpose-classic") && (
            <>
              <div className="field-grid">
                <SelectInput label="Driver instance" value={activeWorkload.driverInstance} options={instances.map((instance) => ({ value: instance.id, label: instance.id }))} onChange={(value) => setWorkload("driverInstance", value)} />
                <SelectInput label="Worker instance" value={activeWorkload.workerInstance} options={instances.map((instance) => ({ value: instance.id, label: instance.id }))} onChange={(value) => setWorkload("workerInstance", value)} />
              </div>
              <div className="field-grid">
                <NumberInput label="Worker count" value={activeWorkload.workerCount} min={1} onChange={(value) => setWorkload("workerCount", value)} />
                {activeWorkload.type === "ETL" && <NumberInput label="Pipelines" value={activeWorkload.pipelines} min={1} onChange={(value) => setWorkload("pipelines", value)} />}
              </div>
            </>
          )}

          <div className="field-grid">
            <SelectInput label="Cloud" value={decision.requirements.cloud} options={(["AWS", "Azure", "GCP"] as Cloud[]).map((cloud) => ({ value: cloud, label: cloud }))} onChange={(value) => setCloud(value as Cloud)} />
            <SelectInput label="Region" value={decision.assumptions.region} options={REGIONS_BY_CLOUD[decision.requirements.cloud]} onChange={(value) => setDecision((current) => ({ ...current, assumptions: { region: value } }))} />
          </div>

          <div className="requirement-row">
            <div><Network /><span><b>Private networking</b></span></div>
            <button className={`switch ${decision.requirements.privateNetworking ? "on" : ""}`} role="switch" aria-checked={decision.requirements.privateNetworking} onClick={() => setDecision((current) => ({ ...current, requirements: { ...current.requirements, privateNetworking: !current.requirements.privateNetworking } }))}><span /></button>
          </div>
          {activeWorkload.type === "DWH" && (
            <div className={`requirement-row genie-requirement ${activeWorkload.naturalLanguageAnalytics ? "active" : ""}`}>
              <div><Spark /><span><b>Natural-language Q&amp;A</b></span></div>
              <button className={`switch ${activeWorkload.naturalLanguageAnalytics ? "on" : ""}`} role="switch" aria-label="Require natural-language questions and answers over data" aria-checked={activeWorkload.naturalLanguageAnalytics} onClick={() => setWorkload("naturalLanguageAnalytics", !activeWorkload.naturalLanguageAnalytics)}><span /></button>
            </div>
          )}

          <div className="budget-block">
            <div className="currency-row">
              <div className="currency-toggle" role="group" aria-label="Display currency">
                {(["USD", "INR"] as DisplayCurrency[]).map((currency) => (
                  <button key={currency} className={decision.currency === currency ? "selected" : ""} onClick={() => setDecision((current) => ({ ...current, currency }))}>{currency}</button>
                ))}
              </div>
              <label className="rate-control" htmlFor="conversion-rate">1 USD = <input id="conversion-rate" type="number" min="1" value={decision.usdToInrRate} onChange={(event) => setDecision((current) => ({ ...current, usdToInrRate: Math.max(1, Number(event.target.value)) }))} /> INR</label>
            </div>
            <div className="budget-heading"><label htmlFor="budget">Project budget</label><span>{decision.currency} / {periodLabel}</span></div>
            <div className="budget-input">
              <span>{decision.currency === "INR" ? "₹" : "$"}</span>
              <input id="budget" type="number" min="0" value={displayBudget} onChange={(event) => setDecision((current) => ({ ...current, budget: Number(event.target.value) / (current.currency === "INR" ? current.usdToInrRate : 1) / periodMultiplier }))} />
            </div>
            <div className="budget-presets">
              {[3000, 5000, 10000].map((budget) => (
                <button key={budget} className={decision.budget === budget ? "selected" : ""} onClick={() => setDecision((current) => ({ ...current, budget }))}>{formatCurrency(budget * periodMultiplier, decision.currency, decision.usdToInrRate)}</button>
              ))}
            </div>
          </div>
        </aside>

        <div className="results-panel">
          <div className="results-heading">
            <div><p className="section-index">02 / OPTIONS FOR {activeWorkload.name}</p><h2>{activeWorkload.type} compute field</h2></div>
            <p>
              {decision.workloads.length} workload{decision.workloads.length === 1 ? "" : "s"} · configured project {formatCurrency(comparison.currentPortfolioCost, decision.currency, decision.usdToInrRate)} / month
              <a href={pricingSource.url} target="_blank" rel="noreferrer">{pricingSource.label} ↗</a>
            </p>
          </div>

          <RecommendationBanner decision={decision} comparison={comparison} onBudgetChange={(budget) => setDecision((current) => ({ ...current, budget }))} />

          <ComparisonExperience
            decision={decision}
            comparison={comparison}
            onSelectOption={(computeId) => setWorkload("computeId", computeId)}
          />

          <section className="schedule-card">
            <div className="schedule-title">
              <div><p className="section-index">SCHEDULE / {activeWorkload.name}</p><h2>When does it run?</h2></div>
              <Clock />
            </div>
            <p className="schedule-copy">Schedule changes runtime cost; it does not define the workload category.</p>
            <div className="schedule-tabs" role="tablist" aria-label="Schedule period">
              <button role="tab" aria-selected={scheduleView === "monthly"} className={scheduleView === "monthly" ? "active" : ""} onClick={() => setScheduleView("monthly")}>Monthly schedule</button>
              <button role="tab" aria-selected={scheduleView === "weekly"} className={scheduleView === "weekly" ? "active" : ""} onClick={() => setScheduleView("weekly")}>Weekly schedule</button>
            </div>
            <RangeField label="Execution hours per day" value={activeWorkload.hoursPerDay} min={1} max={24} suffix="hours" onChange={(value) => setWorkload("hoursPerDay", value)} />
            {scheduleView === "monthly" ? (
              <RangeField label="Execution days per month" value={activeWorkload.daysPerMonth} min={1} max={31} suffix="days" onChange={(value) => setWorkload("daysPerMonth", value)} />
            ) : (
              <RangeField label="Execution days per week" value={Math.min(7, Math.max(1, Math.round(activeWorkload.daysPerMonth / 4.33)))} min={1} max={7} suffix="days" onChange={(value) => setWorkload("daysPerMonth", Math.min(31, Math.round(value * 4.33)))} />
            )}
            <p className="hours-note">{configuredBreakdown.monthlyHours} monthly hours used for {activeWorkload.name}.</p>
            <div className="timing-presets">
              <p>OPERATIONAL TIMING PRESETS:</p>
              <div>
                <button onClick={() => updateActiveWorkload((workload) => ({ ...workload, hoursPerDay: 24, daysPerMonth: 31 }))}>24/7 Always on</button>
                <button onClick={() => updateActiveWorkload((workload) => ({ ...workload, hoursPerDay: 8, daysPerMonth: 22 }))}>Business hours</button>
                <button onClick={() => updateActiveWorkload((workload) => ({ ...workload, hoursPerDay: 3, daysPerMonth: 30 }))}>Daily batch</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <footer>
        <div><span className="brand-mark small"><span /></span><b>StrategyShifu</b></div>
        <p>Planning rates · VM catalog refreshed {VM_PRICING_REFRESHED_AT} · taxes, disks, transfer and discounts excluded.</p>
        <span>DECIDE WITH YOUR AGENT.</span>
      </footer>
    </main>
  );
}

type ComparisonView = "compare" | "why";

function ComparisonExperience({
  decision,
  comparison,
  onSelectOption,
}: {
  decision: DecisionState;
  comparison: ReturnType<typeof compareStrategies>;
  onSelectOption: (computeId: ComputeId) => void;
}) {
  const [view, setView] = useState<ComparisonView>("compare");
  const evaluations = comparison.evaluations;
  const recommendedIndex = evaluations.findIndex((evaluation) => evaluation.recommended);

  return (
    <section className="comparison-experience" aria-label="Compute option comparison">
      <div className="comparison-toolbar">
        <div className="comparison-view-tabs" role="tablist" aria-label="Comparison view">
          <button role="tab" aria-selected={view === "compare"} className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>Compare options</button>
          <button role="tab" aria-selected={view === "why"} className={view === "why" ? "active" : ""} onClick={() => setView("why")}>Why this is recommended</button>
        </div>
      </div>

      {view === "why" ? (
        <WhyRecommended decision={decision} comparison={comparison} onSelectOption={onSelectOption} />
      ) : (
        <>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col" className="row-heading option-heading"><span>OPTION</span><small>Regional planning comparison</small></th>
                  {evaluations.map((evaluation) => (
                    <th scope="col" key={evaluation.strategy.id} className={evaluation.recommended ? "recommended-column" : ""}>
                      <OptionHeader evaluation={evaluation} decision={decision} onSelectOption={onSelectOption} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Technical fit" hint="Hard requirements must pass before an option can be recommended." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => (
                    <div key={evaluation.strategy.id} className={`table-signal ${evaluation.technicalFit ? "pass" : "fail"}`}>
                      <i>{evaluation.technicalFit ? <Check /> : <Close />}</i>
                      <span><b>{evaluation.technicalFit ? "Pass" : "Fail"}</b><small>{evaluation.reasoning[0]}</small></span>
                    </div>
                  ))}
                </ComparisonRow>
                {comparison.activeWorkload.naturalLanguageAnalytics && (
                  <ComparisonRow label="Databricks Genie" hint="Genie enables chat-based and natural-language questions over data and is supported on Serverless and Pro SQL warehouses." recommendedIndex={recommendedIndex}>
                    {evaluations.map((evaluation) => (
                      <div key={evaluation.strategy.id} className={`table-signal ${evaluation.strategy.supportsGenie ? "pass" : "fail"}`}>
                        <i>{evaluation.strategy.supportsGenie ? <Check /> : <Close />}</i>
                        <span><b>{evaluation.strategy.supportsGenie ? "Supported" : "Not supported"}</b><small>{evaluation.strategy.supportsGenie ? "Chat + NLP questions over data" : "Genie requires Serverless or Pro SQL"}</small></span>
                      </div>
                    ))}
                  </ComparisonRow>
                )}
                <ComparisonRow label="Workload cost" hint="Monthly cost for the active workload only." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => (
                    <div key={evaluation.strategy.id} className="table-metric"><b>{formatCurrency(evaluation.workloadCost, decision.currency, decision.usdToInrRate)}</b><small>{formatHourlyRate(evaluation.costBreakdown.totalHourlyRate, decision.currency, decision.usdToInrRate)} / runtime hour</small></div>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Project cost" hint="Includes the configured cost of every other workload." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => <PortfolioCost key={evaluation.strategy.id} evaluation={evaluation} decision={decision} />)}
                </ComparisonRow>
                <ComparisonRow label="Performance & scale" hint="Qualitative operating model; actual performance depends on workload behavior." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => <TextMetric key={evaluation.strategy.id} title={evaluation.strategy.performanceLabel} detail={evaluation.strategy.performanceDetail} />)}
                </ComparisonRow>
                <ComparisonRow label="Operational effort" hint="Relative effort based on the compute lifecycle and infrastructure boundary." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => <TextMetric key={evaluation.strategy.id} title={evaluation.strategy.operationalEffort} detail={evaluation.strategy.operationalDetail} />)}
                </ComparisonRow>
                <ComparisonRow label="Best for" hint="Common fit guidance, not a hard eligibility rule." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => <TextMetric key={evaluation.strategy.id} title={evaluation.strategy.bestFor} />)}
                </ComparisonRow>
                <ComparisonRow label="Key trade-offs" hint="The strongest advantage and limitation in the current planning model." recommendedIndex={recommendedIndex}>
                  {evaluations.map((evaluation) => (
                    <ul className="table-tradeoffs" key={evaluation.strategy.id}>
                      <li className="positive"><Check />{evaluation.strategy.advantages[0]}</li>
                      <li className="negative"><Close />{evaluation.strategy.disadvantages[0]}</li>
                    </ul>
                  ))}
                </ComparisonRow>
              </tbody>
            </table>
          </div>
          <div className={`mobile-strategy-grid strategy-grid count-${evaluations.length}`}>
            {evaluations.map((evaluation, index) => <StrategyCard key={evaluation.strategy.id} evaluation={evaluation} rank={index + 1} decision={decision} />)}
          </div>
        </>
      )}
    </section>
  );
}

function OptionHeader({ evaluation, decision, onSelectOption }: { evaluation: Evaluation; decision: DecisionState; onSelectOption: (computeId: ComputeId) => void }) {
  return (
    <div className="table-option-header">
      <div className="table-option-badges">
        {evaluation.recommended && <span className="table-recommended"><Spark /> RECOMMENDED</span>}
        {evaluation.configured && <span className="table-current">CURRENT</span>}
        {getActiveWorkload(decision).naturalLanguageAnalytics && evaluation.strategy.supportsGenie && <span className="table-genie"><Spark /> GENIE</span>}
      </div>
      <div className="table-option-title"><i className={evaluation.configured ? "selected" : ""} /><span><b>{evaluation.strategy.shortName}</b><small>{evaluation.strategy.category}</small></span></div>
      <strong>{formatCurrency(evaluation.workloadCost, decision.currency, decision.usdToInrRate)} <small>/ month</small></strong>
      <BudgetDelta evaluation={evaluation} decision={decision} />
      {!evaluation.configured && <button className="use-option" onClick={() => onSelectOption(evaluation.strategy.id)}>Use this option</button>}
    </div>
  );
}

function ComparisonRow({ label, hint, recommendedIndex, children }: { label: string; hint: string; recommendedIndex: number; children: React.ReactNode[] }) {
  return (
    <tr>
      <th scope="row" className="row-heading"><span>{label}<i title={hint}>i</i></span></th>
      {children.map((child, index) => <td key={index} className={index === recommendedIndex ? "recommended-column" : ""}>{child}</td>)}
    </tr>
  );
}

function PortfolioCost({ evaluation, decision }: { evaluation: Evaluation; decision: DecisionState }) {
  return <div className="table-metric"><b>{formatCurrency(evaluation.estimatedCost, decision.currency, decision.usdToInrRate)}</b><BudgetDelta evaluation={evaluation} decision={decision} /></div>;
}

function BudgetDelta({ evaluation, decision }: { evaluation: Evaluation; decision: DecisionState }) {
  const difference = decision.budget - evaluation.estimatedCost;
  const percent = Math.round((Math.abs(difference) / Math.max(decision.budget, 1)) * 100);
  return <small className={difference >= 0 ? "budget-under" : "budget-over"}>{percent}% {difference >= 0 ? "under" : "over"} budget</small>;
}

function TextMetric({ title, detail }: { title: string; detail?: string }) {
  return <div className="text-metric"><b>{title}</b>{detail && <small>{detail}</small>}</div>;
}

function WhyRecommended({ decision, comparison, onSelectOption }: { decision: DecisionState; comparison: ReturnType<typeof compareStrategies>; onSelectOption: (computeId: ComputeId) => void }) {
  const winner = comparison.recommendation;
  if (!winner) {
    return <div className="why-panel no-winner"><span><Close /></span><div><p className="section-index">NO ELIGIBLE RECOMMENDATION</p><h3>Every option fails a hard gate.</h3><p>Review Genie support, private networking, and project budget signals in the comparison view.</p></div></div>;
  }
  const alternatives = comparison.evaluations.filter((evaluation) => evaluation.strategy.id !== winner.strategy.id);
  return (
    <div className="why-panel">
      <div className="why-hero">
        <span><Spark /></span>
        <div><p className="section-index">WHY {winner.strategy.shortName.toUpperCase()}</p><h3>{winner.strategy.shortName} balances fit, budget, and operating effort.</h3><p>{comparison.summary}</p></div>
        {!winner.configured && <button className="use-option" onClick={() => onSelectOption(winner.strategy.id)}>Use {winner.strategy.shortName}</button>}
      </div>
      <div className="why-grid">
        <TextMetric title="Hard requirements pass" detail={winner.reasoning[0]} />
        <TextMetric title={`${formatCurrency(winner.workloadCost, decision.currency, decision.usdToInrRate)} workload cost`} detail={`${formatCurrency(winner.estimatedCost, decision.currency, decision.usdToInrRate)} total project`} />
        <TextMetric title={winner.strategy.performanceLabel} detail={winner.strategy.performanceDetail} />
        <TextMetric title={`${winner.strategy.operationalEffort} operational effort`} detail={winner.strategy.operationalDetail} />
      </div>
      {alternatives.length > 0 && (
        <div className="alternative-reasons">
          <p className="section-index">WHY THE OTHERS RANK LOWER</p>
          {alternatives.map((evaluation) => (
            <div key={evaluation.strategy.id}><b>{evaluation.strategy.shortName}</b><span>{!evaluation.technicalFit ? evaluation.reasoning[0] : !evaluation.budgetFit ? `${formatCurrency(evaluation.estimatedCost - decision.budget, decision.currency, decision.usdToInrRate)} over budget.` : `${evaluation.strategy.operationalEffort} operational effort and a lower overall decision score.`}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationBanner({ decision, comparison, onBudgetChange }: { decision: DecisionState; comparison: ReturnType<typeof compareStrategies>; onBudgetChange: (budget: number) => void }) {
  const winner = comparison.recommendation;
  if (!winner) {
    const lowestValid = comparison.evaluations.filter((item) => item.technicalFit).sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
    return (
      <div className="recommendation-banner warning">
        <div className="recommendation-icon"><Close /></div>
        <div className="recommendation-copy">
          <p className="section-index">PROJECT STATUS</p>
          <h3>No valid option fits {formatCurrency(decision.budget, decision.currency, decision.usdToInrRate)}.</h3>
          <p>{lowestValid ? `The lowest valid project needs ${formatCurrency(lowestValid.estimatedCost - decision.budget, decision.currency, decision.usdToInrRate)} more per month.` : "Review Genie, networking, and workload compatibility requirements to reveal another option."}</p>
        </div>
        {lowestValid && <button onClick={() => onBudgetChange(Math.ceil(lowestValid.estimatedCost / 50) * 50)}>Raise budget to {formatCurrency(Math.ceil(lowestValid.estimatedCost / 50) * 50, decision.currency, decision.usdToInrRate)} <ArrowUpRight /></button>}
      </div>
    );
  }
  return (
    <div className="recommendation-banner success">
      <div className="recommendation-icon"><Spark /></div>
      <div className="recommendation-copy">
        <p className="section-index">RECOMMENDED FOR {comparison.activeWorkload.name}</p>
        <h3>{winner.strategy.shortName}</h3>
        <p>{comparison.summary}</p>
      </div>
      <div className="recommendation-metric">
        <span>PROJECT / MONTH</span><strong>{formatCurrency(winner.estimatedCost, decision.currency, decision.usdToInrRate)}</strong>
        <small>{formatCurrency(decision.budget - winner.estimatedCost, decision.currency, decision.usdToInrRate)} remaining</small>
      </div>
    </div>
  );
}

function StrategyCard({ evaluation, rank, decision }: { evaluation: Evaluation; rank: number; decision: DecisionState }) {
  const { strategy, costBreakdown: pricing } = evaluation;
  return (
    <article className={`strategy-card ${evaluation.recommended ? "recommended" : ""} ${evaluation.configured ? "configured" : ""}`}>
      {(evaluation.recommended || evaluation.configured) && <div className={`recommended-flag ${evaluation.configured && !evaluation.recommended ? "current" : ""}`}>{evaluation.recommended ? <><Spark /> RECOMMENDED</> : "CURRENT"}</div>}
      <div className="card-topline"><span>0{rank}</span><small>{strategy.category}</small></div>
      <h3>{strategy.shortName}</h3>
      <p className="strategy-full-name">{strategy.name}</p>
      {getActiveWorkload(decision).naturalLanguageAnalytics && <span className={`genie-card-badge ${strategy.supportsGenie ? "supported" : "unsupported"}`}>{strategy.supportsGenie ? "Genie · Chat + NLP" : "Genie not supported"}</span>}
      <p className="strategy-description">{strategy.description}</p>
      <div className="cost-row">
        <span><small>WORKLOAD / MONTH</small><b>{formatCurrency(evaluation.workloadCost, decision.currency, decision.usdToInrRate)}</b></span>
        <span className="score"><small>PROJECT TOTAL</small><b>{formatCurrency(evaluation.estimatedCost, decision.currency, decision.usdToInrRate)}</b></span>
      </div>
      <div className="pricing-breakdown">
        <div><span>DBU compute</span><b>{formatCurrency(pricing.dbuCost, decision.currency, decision.usdToInrRate)}</b><small>{pricing.dbuPerHour} DBU/h × {formatHourlyRate(pricing.dbuRatePerDbu, decision.currency, decision.usdToInrRate)}</small></div>
        <div><span>Cloud infrastructure</span><b>{pricing.includesCloudInstance ? "Included" : formatCurrency(pricing.infrastructureCost, decision.currency, decision.usdToInrRate)}</b><small>{pricing.includesCloudInstance ? "Included in DBU rate" : `1 driver + ${pricing.workerCount} worker${pricing.workerCount === 1 ? "" : "s"}`}</small></div>
        <p><span>{pricing.warehouseSize ? `${pricing.warehouseSize} · ` : ""}{pricing.region}</span><b>{formatHourlyRate(pricing.totalHourlyRate, decision.currency, decision.usdToInrRate)} / hour</b></p>
      </div>
      <div className="fit-grid">
        <Status label="Technical fit" pass={evaluation.technicalFit} passText="Pass" failText="Fail" />
        <Status label="Budget fit" pass={evaluation.budgetFit} passText="Within" failText="Over" />
      </div>
      <div className="card-reason"><p>KEY DECISION SIGNAL</p><span className={evaluation.technicalFit ? "signal-pass" : "signal-fail"}>{evaluation.technicalFit ? <Check /> : <Close />}{evaluation.reasoning[0]}</span></div>
      <div className="tradeoffs"><p>TRADE-OFFS</p><ul><li>+ {strategy.advantages[0]}</li><li>− {strategy.disadvantages[0]}</li></ul></div>
      <div className="budget-track"><span style={{ width: `${Math.min(100, (evaluation.estimatedCost / Math.max(decision.budget, 1)) * 100)}%` }} /></div>
      <small className="budget-caption">{Math.round((evaluation.estimatedCost / Math.max(decision.budget, 1)) * 100)}% OF PROJECT BUDGET</small>
    </article>
  );
}

function Status({ label, pass, passText, failText }: { label: string; pass: boolean; passText: string; failText: string }) {
  return <div className="fit-status"><span>{label}</span><b className={pass ? "pass" : "fail"}>{pass ? <Check /> : <Close />}{pass ? passText : failText}</b></div>;
}

function NumberInput({ label, value, min, step = 1, onChange }: { label: string; value: number; min: number; step?: number; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replaceAll(" ", "-").replace("/", "");
  return <div className="form-section"><label className="field-label" htmlFor={id}>{label}</label><div className="number-field"><input id={id} type="number" min={min} step={step} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></div></div>;
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <div className="form-section"><label className="field-label" htmlFor={id}>{label}</label><div className="select-field"><select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown /></div></div>;
}

function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <div className="range-field"><div><label>{label}</label><b>{value} <span>{suffix}</span></b></div><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ "--range-fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties} /></div>;
}
