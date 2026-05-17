import { logger } from '../../logger';
import { TIME } from '../../constants';
import { generateSessionId } from '../../utils/id-generator';
import { Session } from './types';
import { IdentityBase } from './base';

/**
 * Session-related identity operations.
 */
export class SessionOps extends IdentityBase {
  /**
   * Get session from storage.
   */
  async getSession(sessionId: string, orgId?: string): Promise<Session | undefined> {
    try {
      const items = await this.base.queryItems({
        KeyConditionExpression: 'userId = :pk AND #ts = :zero',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':pk': this.getSessionKey(sessionId, orgId),
          ':zero': 0,
        },
      });

      if (items.length > 0) {
        const item = items[0];
        return {
          sessionId,
          userId: item.sessionUserId as string,
          workspaceId: item.workspaceId as string | undefined,
          startTime: item.startTime as number,
          lastActivityTime: item.lastActivityTime as number,
          expiresAt: item.expiresAt as number,
          metadata: item.metadata as Record<string, unknown> | undefined,
        };
      }
    } catch (error) {
      logger.error(`Failed to load session ${sessionId}:`, error);
    }
    return undefined;
  }

  /**
   * Save session to storage.
   */
  async saveSession(session: Session, orgId?: string): Promise<void> {
    try {
      // 1. Save session item by sessionId (for direct O(1) retrieval)
      await this.base.putItem(
        {
          userId: this.getSessionKey(session.sessionId, orgId),
          timestamp: 0,
          type: 'SESSION',
          sessionUserId: session.userId,
          workspaceId: session.workspaceId,
          startTime: session.startTime,
          lastActivityTime: session.lastActivityTime,
          expiresAt: session.expiresAt,
          metadata: session.metadata,
          ttl: Math.floor(session.expiresAt / 1000),
        },
        {
          ConditionExpression: 'attribute_not_exists(userId) OR #tp = :type',
          ExpressionAttributeNames: { '#tp': 'type' },
          ExpressionAttributeValues: { ':type': 'SESSION' },
        }
      );

      // 2. Dual-write: save session reference under user ID partition (for UserInsightIndex GSI lookup)
      await this.base.putItem(
        {
          userId: this.getUserKey(session.userId, orgId),
          timestamp: session.startTime, // unique range key per session
          type: 'SESSION',
          sessionId: session.sessionId,
          sessionUserId: session.userId,
          workspaceId: session.workspaceId,
          startTime: session.startTime,
          lastActivityTime: session.lastActivityTime,
          expiresAt: session.expiresAt,
          metadata: session.metadata,
          ttl: Math.floor(session.expiresAt / 1000),
        },
        {
          ConditionExpression: 'attribute_not_exists(userId) OR #tp = :type',
          ExpressionAttributeNames: { '#tp': 'type' },
          ExpressionAttributeValues: { ':type': 'SESSION' },
        }
      );
    } catch (error) {
      logger.error(`Failed to save session ${session.sessionId}:`, error);
    }
  }

  /**
   * Create a new session.
   */
  async createSession(
    userId: string,
    workspaceId: string | undefined,
    metadata?: Record<string, unknown>
  ): Promise<Session> {
    const sessionId = generateSessionId();
    const now = Date.now();
    const session: Session = {
      sessionId,
      userId,
      workspaceId,
      startTime: now,
      lastActivityTime: now,
      expiresAt: now + 24 * TIME.MS_PER_HOUR,
      metadata,
    };

    await this.saveSession(session, metadata?.orgId as string | undefined);
    return session;
  }

  /**
   * Terminate a session.
   */
  async terminateSession(sessionId: string, orgId?: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId, orgId);
      if (session) {
        // Delete primary session item
        await this.base.deleteItem({
          userId: this.getSessionKey(sessionId, orgId),
          timestamp: 0,
        });
        // Delete user session reference item
        await this.base.deleteItem({
          userId: this.getUserKey(session.userId, orgId),
          timestamp: session.startTime,
        });
        logger.info(`Session terminated: ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Failed to terminate session ${sessionId}:`, error);
    }
  }

  /**
   * Get all active sessions for a user.
   */
  async getUserSessions(userId: string, workspaceId?: string, orgId?: string): Promise<Session[]> {
    try {
      // Optimized: Use UserInsightIndex (userId + type) for efficient lookup
      // instead of scanning all sessions in a workspace (Anti-Pattern 19).
      const result = await this.base.queryItemsPaginated({
        IndexName: 'UserInsightIndex',
        KeyConditionExpression: 'userId = :pk AND #tp = :type',
        ExpressionAttributeNames: {
          '#tp': 'type',
        },
        ExpressionAttributeValues: {
          ':pk': this.getUserKey(userId, orgId), // Organization-scoped user key
          ':type': 'SESSION',
        },
        FilterExpression: workspaceId ? 'workspaceId = :wsId' : undefined,
        ...(workspaceId
          ? {
              ExpressionAttributeValues: {
                ':pk': this.getUserKey(userId, orgId),
                ':type': 'SESSION',
                ':wsId': workspaceId,
              },
            }
          : {}),
        Limit: 100,
        ScanIndexForward: false,
      });

      return result.items.map((item) => ({
        sessionId: (item.sessionId as string) || (item.userId as string).split('#').pop()!,
        userId: item.sessionUserId as string,
        workspaceId: item.workspaceId as string | undefined,
        startTime: item.startTime as number,
        lastActivityTime: item.lastActivityTime as number,
        expiresAt: item.expiresAt as number,
        metadata: item.metadata as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      logger.error(`Failed to get sessions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Cleanup expired sessions.
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    try {
      const { getMemoryByType } = await import('../../memory/utils');
      const items = await getMemoryByType(this.base, 'SESSION', 1000);
      let cleaned = 0;

      for (const item of items) {
        if (now > (item.expiresAt as number)) {
          const sessionId = (item.userId as string).split('#').pop()!;
          const orgId = (item.userId as string).includes('ORG#')
            ? (item.userId as string).split('#')[2]
            : undefined;
          await this.terminateSession(sessionId, orgId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired sessions`);
      }
      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }
}
