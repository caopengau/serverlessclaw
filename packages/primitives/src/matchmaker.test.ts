import { describe, it, expect } from 'vitest';
import { UniversalMatchmaker, Entity } from './matchmaker';

describe('UniversalMatchmaker', () => {
  it('should match supply with demand based on capacity', () => {
    const matchmaker = new UniversalMatchmaker();
    const supply: Entity[] = [
      { id: 's1', type: 'supply', capacity: 10, price: 50 },
      { id: 's2', type: 'supply', capacity: 20, price: 40 },
    ];
    const demand: Entity[] = [{ id: 'd1', type: 'demand', capacity: 15, price: 45 }];

    const matches = matchmaker.match(supply, demand);

    expect(matches.length).toBeGreaterThan(0);
    // s2 has lowest price (40), should be matched first to fill 15
    expect(matches[0].supplyId).toBe('s2');
    expect(matches[0].allocatedCapacity).toBe(15);
  });

  it('should consider location for higher scoring', () => {
    const matchmaker = new UniversalMatchmaker();
    const supply: Entity[] = [
      { id: 's1', type: 'supply', capacity: 10, price: 50, location: 'zone-a' },
    ];
    const demand: Entity[] = [
      { id: 'd1', type: 'demand', capacity: 10, price: 55, location: 'zone-a' },
      { id: 'd2', type: 'demand', capacity: 10, price: 55, location: 'zone-b' },
    ];

    const matches = matchmaker.match(supply, demand);

    expect(matches.length).toBeGreaterThan(0);
    // d1 matches location, should have higher score
    const matchD1 = matches.find((m) => m.demandId === 'd1');
    expect(matchD1).toBeDefined();
    expect(matchD1?.score).toBeGreaterThan(0.5);
  });
});
