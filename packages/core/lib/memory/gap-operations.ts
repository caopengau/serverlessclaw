/**
 * Gap Operations Module
 *
 * Central hub for gap management in the DynamoMemory class.
 * Decomposed into specialized sub-modules to maintain small file size and high AI readiness.
 */

export {
  getAllGaps,
  getGap,
  setGap,
  incrementGapAttemptCount,
  updateGapStatus,
  updateGapMetadata,
} from './gap/core';

export { archiveStaleGaps, cullResolvedGaps } from './gap/maintenance';

export { acquireGapLock, releaseGapLock, getGapLock } from './gap/locks';

export { assignGapToTrack, getGapTrack, determineTrack } from './gap/tracks';
export type { TrackStore } from './gap/tracks';
