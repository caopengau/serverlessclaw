import { RETENTION } from '../constants';

/**
 * Handles logic for memory tiering and data lifecycle.
 */
export class RetentionManager {
  /**
   * Calculates the expiration timestamp for a given item type and unit.
   */
  static async getExpiresAt(prefix: string, userId: string): Promise<{ expiresAt: number, type: string }> {
    const now = Math.floor(Date.now() / 1000);
    
    // 1. Transient System Logs (1 hour)
    if (userId.startsWith('RECOVERY') || userId.startsWith('SYSTEM#')) {
      return { 
        expiresAt: now + 3600, 
        type: 'MESSAGE' 
      };
    }

    // 2. Internal Agent Traces (1 day)
    const agentPrefixes = ['COGNITION-REFLECTOR#', 'CODER#', 'STRATEGIC-PLANNER#', 'QA#'];
    if (userId.includes('#') && agentPrefixes.some(p => userId.startsWith(p))) {
      return { 
        expiresAt: now + 24 * 60 * 60, 
        type: 'MESSAGE' 
      };
    }

    // 3. Strategic Intelligence (2 years)
    if (prefix === 'DISTILLED' || prefix === 'GAP' || prefix === 'LESSON') {
      return { 
        expiresAt: now + 730 * 24 * 60 * 60, 
        type: prefix 
      };
    }

    // 4. Default: Human Conversations (Fetch from AgentRegistry)
    const { AgentRegistry } = await import('../registry');
    let days = 30; // Safe default
    try {
      if (prefix === 'SESSIONS') {
        days = await AgentRegistry.getRetentionDays('SESSIONS_DAYS');
      } else {
        days = await AgentRegistry.getRetentionDays('MESSAGES_DAYS');
      }
    } catch (e) {
      // Fallback
      days = prefix === 'SESSIONS' ? RETENTION.SESSIONS_DAYS : RETENTION.MESSAGES_DAYS;
    }

    return { 
      expiresAt: now + days * 24 * 60 * 60, 
      type: prefix === 'SESSIONS' ? 'SESSION' : 'MESSAGE' 
    };
  }
}
