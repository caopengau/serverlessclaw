import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string(),
  type: z.enum(['supply', 'demand']),
  capacity: z.number(), // MW or kW depending on context
  price: z.number().optional(), // Expected or target price
  location: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type Entity = z.infer<typeof EntitySchema>;

export interface MatchScore {
  supplyId: string;
  demandId: string;
  score: number; // 0 to 1
  allocatedCapacity: number;
}

/**
 * Universal Matchmaker
 * Evaluates supply and demand entities and scores their compatibility for dispatch.
 */
export class UniversalMatchmaker {
  /**
   * Matches supply entities to demand entities based on a simple capacity/price heuristic.
   */
  match(supply: Entity[], demand: Entity[]): MatchScore[] {
    const validSupply = supply.filter((s) => s.type === 'supply' && s.capacity > 0);
    const validDemand = demand.filter((d) => d.type === 'demand' && d.capacity > 0);

    const matches: MatchScore[] = [];

    // Basic greedy algorithm for matchmaking
    for (const d of validDemand) {
      let remainingDemand = d.capacity;

      // Sort supply by lowest price first (if available) or highest capacity
      const sortedSupply = validSupply.sort((a, b) => {
        if (a.price !== undefined && b.price !== undefined) {
          return a.price - b.price;
        }
        return b.capacity - a.capacity;
      });

      for (const s of sortedSupply) {
        if (remainingDemand <= 0) break;
        if (s.capacity <= 0) continue;

        const allocation = Math.min(remainingDemand, s.capacity);
        remainingDemand -= allocation;
        s.capacity -= allocation; // Mutating capacity to reflect allocation

        // Scoring heuristic: higher score for exact location match or lower price
        let score = 0.5; // Base score
        if (s.location && d.location && s.location === d.location) {
          score += 0.3;
        }
        if (s.price !== undefined && d.price !== undefined && s.price <= d.price) {
          score += 0.2;
        }

        matches.push({
          supplyId: s.id,
          demandId: d.id,
          score: Math.min(score, 1.0),
          allocatedCapacity: allocation,
        });
      }
    }

    return matches;
  }
}
