/**
 * JSON Schema definition for tool parameters.
 */
export interface JsonSchema {
  /** The data type (e.g., 'string', 'object', 'array'). */
  type: string;
  /** Human-readable description of the property. */
  description?: string;
  /** Nested properties for object types. */
  properties?: Record<string, JsonSchema>;
  /** List of required property names. */
  required?: string[];
  /** Schema for array items. */
  items?: JsonSchema;
  /** Allowed values for the property. */
  enum?: string[];
  /** Whether additional properties are allowed. */
  additionalProperties?: boolean;
}

/**
 * Metadata definition for a tool, used to inform the LLM about its usage.
 */
export interface IToolDefinition {
  /** The unique name of the tool. */
  name: string;
  /** Clear description of what the tool does and when to use it. */
  description: string;
  /** Schema defining the arguments expected by the tool. */
  parameters: JsonSchema;
}

/**
 * Full tool implementation including its metadata and execution logic.
 */
export interface ITool extends IToolDefinition {
  /**
   * Executes the tool with the provided arguments.
   * 
   * @param args - Key-value pairs of arguments as defined in the parameters schema.
   * @returns A promise resolving to the string output of the tool execution.
   */
  execute(args: Record<string, unknown>): Promise<string>;
}
