import { UserRole, Permission, AgentRole, AccessControlEntry } from '../../types/security';
export { UserRole, Permission, AgentRole, AccessControlEntry };

/**
 * User identity.
 */
export interface UserIdentity {
  /** Unique user ID. */
  userId: string;
  /** Display name. */
  displayName: string;
  /** Email address. */
  email?: string;
  /** User role. */
  role: UserRole;
  /** Workspace IDs the user belongs to. */
  workspaceIds: string[];
  /** Team ID. */
  teamId?: string;
  /** Staff ID within organization. */
  staffId?: string;
  /** Authentication provider. */
  authProvider: 'telegram' | 'dashboard' | 'api_key';
  /** When the user was created. */
  createdAt: number;
  /** Last active timestamp. */
  lastActiveAt: number;
  /** Securely hashed password/keyphrase. */
  hashedPassword?: string;
}

/**
 * Session state.
 */
export interface Session {
  /** Unique session ID. */
  sessionId: string;
  /** User ID for this session. */
  userId: string;
  /** Workspace ID for this session. */
  workspaceId?: string;
  /** Team ID for this session. */
  teamId?: string;
  /** Staff ID for this session. */
  staffId?: string;
  /** Session start time. */
  startTime: number;
  /** Last activity time. */
  lastActivityTime: number;
  /** Session expiration time. */
  expiresAt: number;
  /** Session metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication result.
 */
export interface AuthResult {
  /** Whether authentication succeeded. */
  success: boolean;
  /** Authentication result. */
  user?: UserIdentity;
  /** Session if authenticated. */
  session?: Session;
  /** Error message if failed. */
  error?: string;
  }

