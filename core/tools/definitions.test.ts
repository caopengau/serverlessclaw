import { describe, it, expect } from 'vitest';
import { toolDefinitions } from './definitions';

describe('Tool Definitions Schema Validation', () => {
  it('all tool parameter schemas MUST include additionalProperties: false', () => {
    Object.entries(toolDefinitions).forEach(([toolName, definition]) => {
      // Logic for strict schema validation expected by modern LLM providers
      expect(definition.parameters, `Tool "${toolName}" is missing parameters`).toBeDefined();
      expect(definition.parameters.type).toBe('object');

      // If it's an object type, it MUST have additionalProperties: false
      expect(
        definition.parameters.additionalProperties,
        `Tool "${toolName}" parameters MUST have additionalProperties: false for LLM compatibility.`
      ).toBe(false);

      // NEW: All properties MUST be in the required array for strict mode
      if (
        definition.parameters.properties &&
        Object.keys(definition.parameters.properties).length > 0
      ) {
        const propKeys = Object.keys(definition.parameters.properties);
        const requiredKeys = definition.parameters.required || [];

        propKeys.forEach((key) => {
          expect(
            requiredKeys,
            `Tool "${toolName}" is missing "${key}" from its "required" array. Strict mode requires all properties to be required.`
          ).toContain(key);
        });
      }

      // Recursive check for nested properties
      if (definition.parameters.properties) {
        Object.entries(definition.parameters.properties).forEach(([propName, propSchema]) => {
          if (propSchema.type === 'object') {
            expect(
              propSchema.additionalProperties,
              `Nested property "${propName}" in tool "${toolName}" MUST have additionalProperties: false.`
            ).toBe(false);
          }
        });
      }
    });
  });
});
