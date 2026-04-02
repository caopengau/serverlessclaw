import { SafetyTier, SafetyPolicy } from '../types/agent';
import { PROTECTED_FILES } from '../constants';

/**
 * Default safety policies for each tier.
 */
export const DEFAULT_POLICIES: Record<SafetyTier, SafetyPolicy> = {
  [SafetyTier.SANDBOX]: {
    tier: SafetyTier.SANDBOX,
    requireCodeApproval: true,
    requireDeployApproval: true,
    requireFileApproval: true,
    requireShellApproval: true,
    requireMcpApproval: true,
    blockedFilePaths: [...PROTECTED_FILES],
    maxDeploymentsPerDay: 2,
    maxShellCommandsPerHour: 10,
    maxFileWritesPerHour: 20,
    timeRestrictions: [
      {
        daysOfWeek: [0, 6], // Weekends
        startHour: 0,
        endHour: 23,
        timezone: 'UTC',
        restrictedActions: ['deployment', 'shell_command'],
        restrictionType: 'require_approval',
      },
    ],
  },
  [SafetyTier.STAGED]: {
    tier: SafetyTier.STAGED,
    requireCodeApproval: false,
    requireDeployApproval: true,
    requireFileApproval: false,
    requireShellApproval: false,
    requireMcpApproval: false,
    blockedFilePaths: [...PROTECTED_FILES],
    maxDeploymentsPerDay: 5,
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
  [SafetyTier.AUTONOMOUS]: {
    tier: SafetyTier.AUTONOMOUS,
    requireCodeApproval: false,
    requireDeployApproval: false,
    requireFileApproval: false,
    requireShellApproval: false,
    requireMcpApproval: false,
    blockedFilePaths: [...PROTECTED_FILES],
    maxDeploymentsPerDay: 10,
    maxShellCommandsPerHour: 200,
    maxFileWritesPerHour: 500,
  },
};
