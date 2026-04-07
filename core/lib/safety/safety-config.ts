import { SafetyTier, SafetyPolicy } from '../types/agent';
import { PROTECTED_FILES } from '../constants';

/**
 * Default safety policies for each tier.
 */
export const DEFAULT_POLICIES: Record<SafetyTier, SafetyPolicy> = {
  [SafetyTier.LOCAL]: {
    tier: SafetyTier.LOCAL,
    requireCodeApproval: false,
    requireDeployApproval: false,
    requireFileApproval: false,
    requireShellApproval: false,
    requireMcpApproval: false,
    blockedFilePaths: [...PROTECTED_FILES],
    maxDeploymentsPerDay: 50,
    maxShellCommandsPerHour: 200,
    maxFileWritesPerHour: 500,
  },
  [SafetyTier.PROD]: {
    tier: SafetyTier.PROD,
    requireCodeApproval: false,
    requireDeployApproval: true,
    requireFileApproval: false,
    requireShellApproval: false,
    requireMcpApproval: false,
    blockedFilePaths: [...PROTECTED_FILES],
    maxDeploymentsPerDay: 10,
    maxShellCommandsPerHour: 50,
    maxFileWritesPerHour: 100,
    timeRestrictions: [
      {
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        startHour: 9,
        endHour: 17,
        timezone: 'America/New_York',
        restrictedActions: ['deployment'],
        restrictionType: 'require_approval',
      },
    ],
  },
};
