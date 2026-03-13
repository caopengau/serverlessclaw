import { describe, it, expect } from 'vitest';
import { validateAllTools, validateToolSchema } from './schema';
import { IToolDefinition } from './types/index';

describe('Tool Schema Validation', () => {
  it('should pass for all registered tool definitions', () => {
    const isValid = validateAllTools();
    expect(isValid, 'All tool schemas should be valid and follow strict requirements').toBe(true);
  });

  it('should detect missing required properties', () => {
    const invalidTool: IToolDefinition = {
      name: 'invalid',
      description: 'test',
      parameters: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: [],
      },
    };
    const errors = validateToolSchema(invalidTool);
    expect(errors).toContain("Tool 'invalid' property 'foo' is missing from 'required' array.");
  });

  it('should detect missing additionalProperties: false', () => {
    const invalidTool: IToolDefinition = {
      name: 'invalid',
      description: 'test',
      parameters: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      },
    };
    const errors = validateToolSchema(invalidTool);
    expect(errors).toContain(
      "Tool 'invalid' should have 'additionalProperties: false' for strict compliance."
    );
  });
});
