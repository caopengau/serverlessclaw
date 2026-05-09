/**
 * Strips all common prefixes (GAP#, PROC#) from a gap ID.
 */
export function normalizeGapId(gapId: string): string {
  if (!gapId) return '';
  return gapId.replace(/^(GAP#)+/, '').replace(/^(PROC#)+/, '');
}

/**
 * Derives the Partition Key (userId) for a gap item.
 */
export function getGapIdPK(gapId: string): string {
  const normalized = normalizeGapId(gapId);
  const numericMatch = normalized.match(/(\d+)$/);
  const finalId = numericMatch ? numericMatch[1] : normalized;
  return `GAP#${finalId}`;
}

/**
 * Derives the Sort Key (timestamp) for a gap item.
 */
export function getGapTimestamp(gapId: string): number {
  const normalized = normalizeGapId(gapId);
  const numericMatch = normalized.match(/(\d+)$/);
  if (!numericMatch) return 0;
  return parseInt(numericMatch[1], 10);
}

/**
 * Normalizes and cleans an array of tags.
 */
export function normalizeTags(tags?: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase())
    )
  ).sort();
}
