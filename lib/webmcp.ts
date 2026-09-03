export type WebMCPConnectionState = "checking" | "connected" | "unavailable";

export type WebMCPToolSummary = {
  name: string;
  title?: string;
  description: string;
};

type JsonSchemaProperty = {
  type?: "string" | "number" | "integer" | "boolean";
  enum?: readonly unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

type ObjectInputSchema = {
  type?: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: readonly string[];
  additionalProperties?: boolean;
};

export function toolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export async function registerWebMCPTools(
  modelContext: WebMCP.ModelContext,
  tools: WebMCP.ModelContextTool[],
  signal: AbortSignal,
): Promise<WebMCPToolSummary[]> {
  const registrations = await Promise.allSettled(tools.map((tool) =>
    modelContext.registerTool(withRuntimeValidation(tool), { signal }),
  ));

  if (signal.aborted) return [];

  const available = tools.filter((_, index) => registrations[index].status === "fulfilled");
  if (available.length === 0) {
    const firstFailure = registrations.find((registration) => registration.status === "rejected") as PromiseRejectedResult | undefined;
    const detail = firstFailure?.reason instanceof Error ? firstFailure.reason.message : "The browser rejected every tool registration.";
    throw new Error(detail);
  }

  return available.map(({ name, title, description }) => ({ name, title, description }));
}

function withRuntimeValidation(tool: WebMCP.ModelContextTool): WebMCP.ModelContextTool {
  return {
    ...tool,
    execute: (input, options) => {
      validateToolInput(tool.name, input, tool.inputSchema);
      return tool.execute(input, options);
    },
  };
}

function validateToolInput(toolName: string, input: Record<string, unknown>, schema: object | undefined) {
  if (!schema) return;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${toolName} expects a JSON object.`);
  }

  const definition = schema as ObjectInputSchema;
  const properties = definition.properties ?? {};
  for (const required of definition.required ?? []) {
    if (!(required in input) || input[required] === undefined || input[required] === null) {
      throw new Error(`${toolName} requires ${required}. Provide ${required} and retry.`);
    }
  }

  if (definition.additionalProperties === false) {
    const unknown = Object.keys(input).find((key) => !(key in properties));
    if (unknown) {
      throw new Error(`${toolName} does not accept ${unknown}. Use one of: ${Object.keys(properties).join(", ") || "no parameters"}.`);
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const property = properties[key];
    if (!property) continue;

    if (property.type === "number" || property.type === "integer") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${toolName} requires ${key} to be a finite number.`);
      }
      if (property.type === "integer" && !Number.isInteger(value)) {
        throw new Error(`${toolName} requires ${key} to be a whole number.`);
      }
      if (property.minimum !== undefined && value < property.minimum) {
        throw new Error(`${toolName} requires ${key} to be at least ${property.minimum}.`);
      }
      if (property.maximum !== undefined && value > property.maximum) {
        throw new Error(`${toolName} requires ${key} to be no more than ${property.maximum}.`);
      }
    } else if (property.type === "string") {
      if (typeof value !== "string") throw new Error(`${toolName} requires ${key} to be text.`);
      if (property.minLength !== undefined && value.length < property.minLength) {
        throw new Error(`${toolName} requires ${key} to contain at least ${property.minLength} character(s).`);
      }
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        throw new Error(`${toolName} requires ${key} to contain no more than ${property.maxLength} characters.`);
      }
    } else if (property.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`${toolName} requires ${key} to be true or false.`);
    }

    if (property.enum && !property.enum.includes(value)) {
      throw new Error(`${toolName} requires ${key} to be one of: ${property.enum.join(", ")}.`);
    }
  }
}
