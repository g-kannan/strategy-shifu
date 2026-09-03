"use client";

import { useEffect, useRef, useState } from "react";
import { evaluateMigration } from "@/lib/migration-engine";
import type { MigrationInputs } from "@/lib/migration-types";
import type { WebMCPToolSummary } from "./use-webmcp";

type ConnectionState = "checking" | "connected" | "unavailable";

function result(payload: unknown): WebMCPToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}

async function capability(kind: string) {
  const response = await fetch(`/api/migration-capabilities?kind=${kind}`);
  if (!response.ok) throw new Error("Capability validation is temporarily unavailable.");
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
      dataSizeGb: { type: "number", minimum: 0 },
      tableCount: { type: "number", minimum: 0 },
      largestTableGb: { type: "number", minimum: 0 },
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

    const capabilityTool = (name: string, title: string, description: string, kind: string): WebMCPTool => ({
      name, title, description, execute: async () => result(await capability(kind)),
    });

    const tools: WebMCPTool[] = [
      capabilityTool("get_redshift_iceberg_capabilities", "Get Redshift Iceberg capabilities", "Validate current Redshift Iceberg versions, DML operations, and limitations against official documentation.", "redshiftIceberg"),
      capabilityTool("get_databricks_iceberg_capabilities", "Get Databricks Iceberg capabilities", "Validate managed and foreign Iceberg read/write behavior in Databricks.", "databricksIceberg"),
      capabilityTool("get_lakehouse_federation_redshift_capabilities", "Get Redshift federation capabilities", "Validate current Lakehouse Federation support, access mode, use cases, and limits for Redshift.", "federation"),
      capabilityTool("get_redshift_export_options", "Get Redshift export options", "Validate current scalable Redshift bulk-export mechanisms and columnar output support.", "export"),
      {
        name: "get_migration_assessment",
        title: "Get migration assessment",
        description: "Read the current Redshift-to-Databricks inputs, deterministic scores, recommendation, risks, alternative, steps, and architecture.",
        execute: () => result({ inputs: inputsRef.current, recommendation: evaluateMigration(inputsRef.current) }),
      },
      {
        name: "update_migration_inputs",
        title: "Update migration inputs",
        description: "Update one or more advisor inputs; the StrategyShifu scoring engine will immediately recalculate the recommendation.",
        inputSchema: { type: "object", properties: inputProperties, additionalProperties: false },
        execute: (next) => {
          const updated = { ...inputsRef.current, ...next } as MigrationInputs;
          inputsRef.current = updated;
          changeRef.current(updated);
          return result({ updated: true, inputs: updated, recommendation: evaluateMigration(updated) });
        },
      },
      {
        name: "assess_redshift_databricks_migration",
        title: "Assess Redshift to Databricks migration",
        description: "Combine StrategyShifu's deterministic scoring with current structured AWS and Databricks capability evidence.",
        inputSchema: { type: "object", properties: inputProperties, additionalProperties: false },
        execute: async (provided) => {
          const assessmentInputs = { ...inputsRef.current, ...provided } as MigrationInputs;
          const liveCapabilities = await capability("all");
          const recommendation = evaluateMigration(assessmentInputs);
          return result({
            inputs: assessmentInputs,
            recommendation,
            liveCapabilities,
            warnings: recommendation.risks,
            documentationEvidence: capabilityStatements(liveCapabilities),
          });
        },
      },
    ];

    Promise.all(tools.map((tool) => Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal }))))
      .then(() => {
        if (!controller.signal.aborted) {
          setAvailableTools(tools.map(({ name, title, description }) => ({ name, title, description })));
          setConnection("connected");
        }
      })
      .catch(() => { if (!controller.signal.aborted) setConnection("unavailable"); });

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
