import { describe, it, expect } from 'vitest';
import { validateAllTools, validateToolSchema } from './schema';
import { IToolDefinition } from './types/index';
import { TOOLS } from '../tools/index';

describe('Tool Schema Validation', () => {
  it('should pass for all registered tool definitions', () => {
    const isValid = validateAllTools(TOOLS);
    if (!isValid) {
      const allErrors: Record<string, string[]> = {};
      for (const [id, tool] of Object.entries(TOOLS)) {
        const errors = validateToolSchema(tool);
        if (errors.length > 0) {
          allErrors[id] = errors;
        }
      }
      console.error('Tool validation failures:', JSON.stringify(allErrors, null, 2));
    }
    expect(isValid, 'All tool schemas should be valid and follow strict requirements').toBe(true);
  });

  it('should allow optional properties not in required array', () => {
    const validTool: IToolDefinition = {
      name: 'valid',
      description: 'test',
      parameters: {
        type: 'object',
        properties: {
          requiredProp: { type: 'string' },
          optionalProp: { type: 'string' },
        },
        required: ['requiredProp'],
        additionalProperties: false,
      },
    };
    const errors = validateToolSchema(validTool);
    expect(errors).toHaveLength(0);
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
