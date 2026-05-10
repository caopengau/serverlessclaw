import { describe, it, expect } from 'vitest';
import { Ledger } from './ledger';

describe('Ledger (Value Attribution Engine)', () => {
  it('should record transactions and calculate balance', () => {
    const ledger = new Ledger();
    
    ledger.record({
      entityId: 'agent-1',
      type: 'value_creation',
      amount: 100,
      description: 'Solved complex issue',
    });

    ledger.record({
      entityId: 'agent-1',
      type: 'resource_consumption',
      amount: -20,
      description: 'LLM token cost',
    });

    const balance = ledger.getBalance('agent-1');
    expect(balance).toBe(80);
  });

  it('should track total value created', () => {
    const ledger = new Ledger();
    
    ledger.record({
      entityId: 'agent-1',
      type: 'value_creation',
      amount: 150,
    });
    
    ledger.record({
      entityId: 'agent-2',
      type: 'value_creation',
      amount: 200,
    });

    ledger.record({
      entityId: 'agent-1',
      type: 'penalty',
      amount: -50,
    });

    const totalValue = ledger.getTotalValueCreated();
    expect(totalValue).toBe(350); // Penalties shouldn't reduce value_creation total, just balance
  });
});
