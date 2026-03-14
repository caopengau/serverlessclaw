import { describe, it, expect } from 'vitest';
import { SYSTEM, LIMITS, DYNAMO_KEYS, STORAGE, RETENTION, HTTP_STATUS } from './constants';

describe('System constants', () => {
  it('DEFAULT_RECURSION_LIMIT should be 15 (tightened from 50 to cap autonomous cycles)', () => {
    // Previously 50 — allowed ~12 full plan→code→qa loops before the guard fired.
    // 15 allows ~4 cycles which is sufficient while preventing runaway evolution.
    expect(SYSTEM.DEFAULT_RECURSION_LIMIT).toBe(15);
  });

  it('DEFAULT_DEPLOY_LIMIT should be 5', () => {
    expect(SYSTEM.DEFAULT_DEPLOY_LIMIT).toBe(5);
  });

  it('MAX_DEPLOY_LIMIT should be 100 (hard cap to prevent runaway costs)', () => {
    expect(SYSTEM.MAX_DEPLOY_LIMIT).toBe(100);
  });

  it('DEPLOY_STATS_KEY should be defined', () => {
    expect(SYSTEM.DEPLOY_STATS_KEY).toBeTruthy();
  });

  it('LIMITS.DEFAULT_LOCK_TTL should be defined (used by DynamoLockManager)', () => {
    expect(LIMITS.DEFAULT_LOCK_TTL).toBeGreaterThan(0);
  });

  it('should expose all required DYNAMO_KEYS', () => {
    expect(DYNAMO_KEYS.DEPLOY_LIMIT).toBeTruthy();
    expect(DYNAMO_KEYS.RECURSION_LIMIT).toBeTruthy();
  });

  it('should expose STORAGE paths', () => {
    expect(STORAGE.STAGING_ZIP).toBeTruthy();
  });

  it('should expose sensible RETENTION days', () => {
    expect(RETENTION.MESSAGES_DAYS).toBeGreaterThan(0);
    expect(RETENTION.LESSONS_DAYS).toBeGreaterThan(RETENTION.MESSAGES_DAYS);
  });

  it('HTTP_STATUS constants should match standard codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
  });
});
