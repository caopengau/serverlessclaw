import { ApiError, requireEnum, requireFields, withApiHandler } from '@/lib/api-handler';
import type { InviteMemberInput, MemberType, WorkspaceRole } from '@claw/core/lib/types/workspace';
import { logger } from '@claw/core/lib/logger';

import { getUserId } from '@/lib/auth-utils';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface WorkspaceData {
  workspaceId: string;
  name?: string;
  ownerId?: string;
  members?: Array<{ id: string; role: string; channel: string }>;
  createdAt?: number;
  orgId?: string;
  teamId?: string;
}

const WORKSPACE_ROLES: WorkspaceRole[] = ['owner', 'admin', 'collaborator', 'observer'];
const MEMBER_TYPES: MemberType[] = ['human', 'agent'];

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(`${fieldName} must be a non-empty string`, 400);
  }
  return value;
}

async function fetchWorkspacesFromConfig(id?: string): Promise<WorkspaceData[]> {
  const { ConfigManager } = await import('@claw/core/lib/registry/config');

  if (id) {
    const data = (await ConfigManager.getRawConfig(`workspace:${id}`)) as WorkspaceData | null;
    return data ? [data] : [];
  }

  const WORKSPACE_INDEX = 'workspace_index';
  const index = ((await ConfigManager.getRawConfig(WORKSPACE_INDEX)) as string[]) ?? [];
  const workspaces: WorkspaceData[] = [];
  for (const workspaceId of index) {
    const data = (await ConfigManager.getRawConfig(
      `workspace:${workspaceId}`
    )) as WorkspaceData | null;
    if (data) {
      workspaces.push(data);
    }
  }
  return workspaces;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    const { getIdentityManager } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();
    const user = await identityManager.getUser(userId);

    if (!user) {
      return Response.json({ workspaces: [] }, { status: 401 });
    }

    const workspaces = await fetchWorkspacesFromConfig(id || undefined);

    // Filter workspaces by membership (Principle 11)
    // Global admins/owners can see all
    const { UserRole } = await import('@claw/core/lib/session/identity/types');
    const filtered = workspaces.filter((w) => {
      if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) return true;
      return user.workspaceIds.includes(w.workspaceId);
    });

    if (id) {
      if (filtered.length === 0) return Response.json({ workspace: null });
      const w = filtered[0];
      return Response.json({
        workspace: {
          id: w.workspaceId,
          name: w.name,
          ownerId: w.ownerId,
          members: w.members,
          createdAt: w.createdAt,
          orgId: w.orgId,
          teamId: w.teamId,
        },
      });
    }

    // Map to the format expected by the frontend
    const formatted = filtered.map((w) => ({
      id: w.workspaceId,
      name: w.name,
      ownerId: w.ownerId,
      members: w.members,
      createdAt: w.createdAt,
      orgId: w.orgId,
      teamId: w.teamId,
    }));
    return Response.json({ workspaces: formatted });
  } catch (e) {
    logger.error('Error fetching workspaces:', e);
    return Response.json({ workspaces: [] });
  }
}

export const POST = withApiHandler(async (body: Record<string, unknown>, req: NextRequest) => {
  const currentUserId = getUserId(req);
  const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
  const identityManager = await getIdentityManager();

  // Handle member management actions
  if (body.action === 'invite') {
    requireFields(body, 'workspaceId', 'memberId', 'role');
    const workspaceId = asNonEmptyString(body.workspaceId, 'workspaceId');
    const memberId = asNonEmptyString(body.memberId, 'memberId');

    // Verify permission (Principle 11)
    const hasPermission = await identityManager.hasPermission(
      currentUserId,
      Permission.WORKSPACE_MEMBERS,
      workspaceId
    );
    if (!hasPermission) {
      throw new ApiError('Unauthorized workspace management', 403);
    }

    const role = body.role;
    requireEnum(role, WORKSPACE_ROLES, 'role');
    const memberType = body.type ?? 'human';
    requireEnum(memberType, MEMBER_TYPES, 'type');
    const input: InviteMemberInput = {
      workspaceId,
      memberId,
      type: memberType,
      displayName:
        typeof body.displayName === 'string' && body.displayName.trim().length > 0
          ? body.displayName
          : memberId,
      role,
    };

    const { inviteMember } = await import('@claw/core/lib/memory/workspace-operations');
    await inviteMember(workspaceId, 'dashboard', input);
    return { success: true };
  }

  if (body.action === 'updateRole') {
    requireFields(body, 'workspaceId', 'memberId', 'role');
    const workspaceId = asNonEmptyString(body.workspaceId, 'workspaceId');
    const memberId = asNonEmptyString(body.memberId, 'memberId');

    // Verify permission (Principle 11)
    const hasPermission = await identityManager.hasPermission(
      currentUserId,
      Permission.WORKSPACE_MEMBERS,
      workspaceId
    );
    if (!hasPermission) {
      throw new ApiError('Unauthorized workspace management', 403);
    }

    const role = body.role;
    requireEnum(role, WORKSPACE_ROLES, 'role');

    const { updateMemberRole } = await import('@claw/core/lib/memory/workspace-operations');
    await updateMemberRole(workspaceId, 'dashboard', memberId, role);
    return { success: true };
  }

  if (body.action === 'remove') {
    requireFields(body, 'workspaceId', 'memberId');
    const workspaceId = asNonEmptyString(body.workspaceId, 'workspaceId');
    const memberId = asNonEmptyString(body.memberId, 'memberId');

    // Verify permission (Principle 11)
    const hasPermission = await identityManager.hasPermission(
      currentUserId,
      Permission.WORKSPACE_MEMBERS,
      workspaceId
    );
    if (!hasPermission) {
      throw new ApiError('Unauthorized workspace management', 403);
    }

    const { removeMember } = await import('@claw/core/lib/memory/workspace-operations');
    await removeMember(workspaceId, 'dashboard', memberId);
    return { success: true };
  }

  // Default: create workspace
  requireFields(body, 'name', 'ownerId');
  const name = asNonEmptyString(body.name, 'name');
  const ownerId = asNonEmptyString(body.ownerId, 'ownerId');

  // Any authenticated user can create a workspace (they become the owner)
  // But they should only be able to create it for themselves (ownerId must match currentUserId)
  if (ownerId !== currentUserId) {
    const user = await identityManager.getUser(currentUserId);
    const { UserRole } = await import('@claw/core/lib/session/identity/types');
    if (user?.role !== UserRole.OWNER && user?.role !== UserRole.ADMIN) {
      throw new ApiError('Cannot create workspace for another user', 403);
    }
  }

  const { createWorkspace } = await import('@claw/core/lib/memory/workspace-operations');
  const workspace = await createWorkspace({
    name,
    ownerId,
    ownerDisplayName: (body.ownerDisplayName as string) ?? 'Unknown',
    orgId: body.orgId as string,
    teamId: body.teamId as string,
  });
  return { success: true, id: workspace.workspaceId };
});
