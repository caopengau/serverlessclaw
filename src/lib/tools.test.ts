import { describe, it, expect } from 'vitest';
import { tools, getToolDefinitions } from '../tools/index';

describe('Tools', () => {
  describe('calculator', () => {
    it('should evaluate 2 + 2 correctly', async () => {
      const result = await tools.calculator.execute({ expression: '2 + 2' });
      expect(result).toBe('Result: 4');
    });

    it('should evaluate complex expressions', async () => {
      const result = await tools.calculator.execute({ expression: '(10 + 5) * 2 / 3' });
      expect(result).toBe('Result: 10');
    });

    it('should return error for invalid expressions', async () => {
      const result = await tools.calculator.execute({ expression: 'invalid + expression' });
      expect(result).toContain('Error:');
    });
  });

  describe('get_weather', () => {
    it('should return mock weather data', async () => {
      const result = await tools.get_weather.execute({ location: 'Sydney, AU' });
      expect(result).toBe('The weather in Sydney, AU is sunny and 72°F.');
    });
  });

  describe('getToolDefinitions', () => {
    it('should return formatted tool definitions', () => {
      const definitions = getToolDefinitions();
      expect(definitions).toHaveLength(8);

      const names = definitions.map((d) => d.function.name);
      expect(names).toContain('calculator');
      expect(names).toContain('get_weather');
      expect(names).toContain('dispatch_task');
      expect(names).toContain('file_write');
      expect(names).toContain('trigger_deployment');
      expect(names).toContain('validate_code');
      expect(names).toContain('check_health');
      expect(names).toContain('trigger_rollback');
    });
  });
});
