import assert from "node:assert/strict";
import test from "node:test";
import { registerWebMCPTools } from "../lib/webmcp";

function modelContext(register: (tool: WebMCP.ModelContextTool) => Promise<void>) {
  return { registerTool: register } as unknown as WebMCP.ModelContext;
}

test("runtime validation rejects values that only violate schema constraints", async () => {
  let registered: WebMCP.ModelContextTool | undefined;
  const tools: WebMCP.ModelContextTool[] = [{
    name: "set_budget",
    description: "Set a monthly budget.",
    inputSchema: {
      type: "object",
      properties: { monthlyBudgetUsd: { type: "number", minimum: 1 } },
      required: ["monthlyBudgetUsd"],
      additionalProperties: false,
    },
    execute: () => ({ updated: true }),
  }];

  await registerWebMCPTools(modelContext(async (tool) => { registered = tool; }), tools, new AbortController().signal);

  const executable = registered;
  assert.ok(executable);
  assert.throws(
    () => executable.execute({ monthlyBudgetUsd: 0 }, { signal: new AbortController().signal }),
    /monthlyBudgetUsd to be at least 1/,
  );
  assert.throws(
    () => executable.execute({ monthlyBudgetUsd: 10, surprise: true }, { signal: new AbortController().signal }),
    /does not accept surprise/,
  );
});

test("partial registration keeps successfully registered tools available", async () => {
  const tools: WebMCP.ModelContextTool[] = [
    { name: "available", description: "Available tool.", execute: () => null },
    { name: "rejected", description: "Rejected tool.", execute: () => null },
  ];
  const context = modelContext(async (tool) => {
    if (tool.name === "rejected") throw new Error("duplicate name");
  });

  const available = await registerWebMCPTools(context, tools, new AbortController().signal);

  assert.deepEqual(available.map((tool) => tool.name), ["available"]);
});

test("registration fails clearly when the browser rejects every tool", async () => {
  const tools: WebMCP.ModelContextTool[] = [
    { name: "rejected", description: "Rejected tool.", execute: () => null },
  ];
  const context = modelContext(async () => { throw new Error("tools permission denied"); });

  await assert.rejects(
    registerWebMCPTools(context, tools, new AbortController().signal),
    /tools permission denied/,
  );
});
