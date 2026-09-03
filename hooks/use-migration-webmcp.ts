"use client";

import { useEffect, useRef, useState } from "react";
import { evaluateMigration } from "@/lib/migration-engine";
import type { MigrationInputs } from "@/lib/migration-types";
import {
  registerWebMCPTools,
  toolResult as result,
  type WebMCPConnectionState as ConnectionState,
  type WebMCPToolSummary,
} from "@/lib/webmcp";

async function capability(kind: string) {
  const response = await fetch(`/api/migration-capabilities?kind=${kind}`);
  if (!response.ok) {
    throw new Error(`Capability evidence is temporarily unavailable (HTTP ${response.status}). Retry later; the deterministic migration assessment remains available.`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export function useMigrationWebMCP(
  inputs: MigrationInputs,
  onInputsChange: (inputs: MigrationInputs) => void,
): { connection: ConnectionState; tools: WebMCPToolSummary[] } {
  const inputsRef = useRef(inputs);
  const changeRef = useRef(onInputsChange);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [availableTools, setAvailableTools] = useState<WebMCPToolSummary[]>([]);

  useEffect(() => { inputsRef.current = inputs; }, [inputs]);
  useEffect(() => { changeRef.current = onInputsChange; }, [onInputsChange]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setConnection("unavailable");
      setAvailableTools([]);
      return;
    }

    const controller = new AbortController();
    const inputProperties = {
      dataSizeGb: { type: "number", minimum: 0, description: "Total source data volume in GB." },
      tableCount: { type: "integer", minimum: 0, description: "Number of source tables in migration scope." },
      largestTableGb: { type: "number", minimum: 0, description: "Largest in-scope source table size in GB." },
      dailyChangeRate: { type: "string", enum: ["< 1%", "1–5%", "5–20%", "> 20%", "Unknown"] },
      writePattern: { type: "string", enum: ["Mostly append", "MERGE / upsert", "Frequent UPDATE", "Frequent DELETE", "Mixed workload", "Mostly read-only"] },
      redshiftSqlComplexity: { type: "string", enum: ["Low", "Medium", "High", "Unknown"] },
      keepRedshiftActive: { type: "boolean" },
      coexistenceDuration: { type: "string", enum: ["< 1 month", "1–3 months", "3–6 months", "> 6 months", "Unknown"] },
      downtimeTolerance: { type: "string", enum: ["Near zero", "< 1 hour", "< 1 day", "Multiple days acceptable"] },
      sharedS3Available: { type: "string", enum: ["Yes", "No", "Unknown"] },
      targetState: { type: "string", enum: ["Databricks becomes primary platform", "Long-term Redshift + Databricks coexistence", "Evaluate Databricks before migration", "Only move selected workloads", "Not decided"] },
      targetFormat: { type: "string", enum: ["Delta Lake", "Iceberg", "No preference", "Not decided"] },
      migrationPriority: { type: "string", enum: ["Data pipelines / ETL", "BI and reporting", "Selected workload POC", "Not decided"] },
      changeSyncPlan: { type: "string", enum: ["Write freeze", "Scheduled incremental loads", "CDC / replication tool", "Dual-write", "No plan", "Unknown"] },
      specialDataTypes: { type: "string", enum: ["None known", "Some", "Extensive", "Unknown"] },
    };

    const capabilityTool = (name: string, title: string, description: string, kind: string): WebMCP.ModelContextTool => ({
      name,
      title,
      description,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => result(await capability(kind)),
    });

    const tools: WebMCP.ModelContextTool[] = [
      capabilityTool("get_redshift_iceberg_capabilities", "Get Redshift Iceberg capabilities", "Validate current Redshift Iceberg versions, DML operations, and limitations against official documentation.", "redshiftIceberg"),
      capabilityTool("get_databricks_iceberg_capabilities", "Get Databricks Iceberg capabilities", "Validate managed and foreign Iceberg read/write behavior in Databricks.", "databricksIceberg"),
      capabilityTool("get_lakehouse_federation_redshift_capabilities", "Get Redshift federation capabilities", "Validate current Lakehouse Federation support, access mode, use cases, and limits for Redshift.", "federation"),
      capabilityTool("get_redshift_export_options", "Get Redshift export options", "Validate current scalable Redshift bulk-export mechanisms and columnar output support.", "export"),
      {
        name: "get_migration_assessment",
        title: "Get migration assessment",
        description: "Read the current Redshift-to-Databricks inputs, deterministic scores, recommendation, risks, alternative, steps, and architecture.",
        annotations: { readOnlyHint: true },
        execute: () => result({ inputs: inputsRef.current, recommendation: evaluateMigration(inputsRef.current) }),
      },
      {
        name: "update_migration_inputs",
        title: "Update migration inputs",
        description: "Update one or more advisor inputs; the StrategyShifu scoring engine will immediately recalculate the recommendation.",
        inputSchema: { type: "object", properties: inputProperties, additionalProperties: false },
        execute: (next) => {
          if (Object.keys(next).length === 0) {
            throw new Error("update_migration_inputs needs at least one migration field to change.");
          }
          const updated = { ...inputsRef.current, ...next } as MigrationInputs;
          inputsRef.current = updated;
          changeRef.current(updated);
          return result({ updated: true, inputs: updated, recommendation: evaluateMigration(updated) });
        },
      },
      {
        name: "assess_redshift_databricks_migration",
        title: "Assess Redshift to Databricks migration",
        description: "Apply supplied migration inputs to the visible workspace, then combine deterministic scoring with current AWS and Databricks capability evidence.",
        annotations: { untrustedContentHint: true },
        inputSchema: { type: "object", properties: inputProperties, additionalProperties: false },
        execute: async (provided) => {
          const assessmentInputs = { ...inputsRef.current, ...provided } as MigrationInputs;
          const liveCapabilities = await capability("all");
          const recommendation = evaluateMigration(assessmentInputs);
          inputsRef.current = assessmentInputs;
          changeRef.current(assessmentInputs);
          return result({
            updated: true,
            inputs: assessmentInputs,
            recommendation,
            liveCapabilities,
            warnings: recommendation.risks,
            documentationEvidence: capabilityStatements(liveCapabilities),
          });
        },
      },
    ];

    registerWebMCPTools(modelContext, tools, controller.signal)
      .then((registeredTools) => {
        if (!controller.signal.aborted) {
          setAvailableTools(registeredTools);
          setConnection("connected");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailableTools([]);
          setConnection("unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  return { connection, tools: availableTools };
}

function capabilityStatements(capabilities: Record<string, unknown>) {
  return Object.entries(capabilities).map(([source, value]) => ({
    statement: JSON.stringify(value),
    source,
  }));
}
