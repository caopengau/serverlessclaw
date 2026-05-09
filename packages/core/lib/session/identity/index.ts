// Barrel file for session identity module
export { IdentityManager, getIdentityManager } from './manager';
export { IdentityBase } from './base';
export { UserOps } from './user-ops';
export { SessionOps } from './session-ops';
export { AccessOps } from './access-ops';
export { UserRole, Permission } from './types';
export type { UserIdentity, Session, AuthResult, AccessControlEntry } from './types';
