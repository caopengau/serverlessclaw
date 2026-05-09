import { describe, it, expect } from 'vitest';
import { ENERGY_AGGREGATOR_SYSTEM_PROMPT, MARKET_TRADER_SYSTEM_PROMPT } from './index';

describe('VoltX Core Prompts', () => {
  describe('ENERGY_AGGREGATOR_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof ENERGY_AGGREGATOR_SYSTEM_PROMPT).toBe('string');
      expect(ENERGY_AGGREGATOR_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain key energy management keywords', () => {
      const keywords = ['energy', 'optimize', 'VPP', 'aggregate'];
      keywords.forEach((keyword) => {
        expect(ENERGY_AGGREGATOR_SYSTEM_PROMPT.toLowerCase()).toContain(keyword.toLowerCase());
      });
    });
  });

  describe('MARKET_TRADER_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof MARKET_TRADER_SYSTEM_PROMPT).toBe('string');
      expect(MARKET_TRADER_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain key trading keywords', () => {
      const keywords = ['market', 'price', 'arbitrage', 'grid'];
      keywords.forEach((keyword) => {
        expect(MARKET_TRADER_SYSTEM_PROMPT.toLowerCase()).toContain(keyword.toLowerCase());
      });
    });
  });
});
