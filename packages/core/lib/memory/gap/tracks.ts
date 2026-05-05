import { EvolutionTrack } from '../../types/agent';

/**
 * Determines the appropriate track for a gap based on its content keywords.
 */
export function determineTrack(content: string): EvolutionTrack {
  const lower = content.toLowerCase();
  if (lower.match(/security|auth|vulnerability|permission|secret|encrypt|xss|csrf|rbac/))
    return EvolutionTrack.SECURITY;
  if (lower.match(/latency|memory|cpu|optimize|slow|timeout|throughput|bottleneck|performance/))
    return EvolutionTrack.PERFORMANCE;
  if (lower.match(/lambda|sst|pipeline|infra|deployment|cloud/))
    return EvolutionTrack.INFRASTRUCTURE;
  if (lower.match(/refactor|duplicate|cleanup|debt|complexity/)) return EvolutionTrack.REFACTORING;
  return EvolutionTrack.FEATURE;
}
