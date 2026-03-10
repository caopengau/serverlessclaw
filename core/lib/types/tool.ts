export interface IToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export interface ITool extends IToolDefinition {
  execute(args: Record<string, unknown>): Promise<string>;
}
