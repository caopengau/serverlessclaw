import { withApiHandler, requireFields } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

interface WorkspaceData {
  workspaceId: string;
  name?: string;
  ownerId?: string;
  members?: Array<{ id: string; role: string; channel: string }>;
  createdAt?: number;
}

async function fetchWorkspacesFromConfig(): Promise<WorkspaceData[]> {
  const { ConfigManager } = await import('@claw/core/lib/registry/config');
  const WORKSPACE_INDEX = 'workspace_index';
  const index = ((await ConfigManager.getRawConfig(WORKSPACE_INDEX)) as string[]) ?? [];
  const workspaces: WorkspaceData[] = [];
  for (const workspaceId of index) {
    const data = (await ConfigManager.getRawConfig(`workspace:${workspaceId}`)) as WorkspaceData | null;
    if (data) {
      workspaces.push({
        workspaceId: data.workspaceId,
        name: data.name ?? 'Unnamed',
        ownerId: data.ownerId ?? '',
        members: data.members ?? [],
        createdAt: data.createdAt ?? 0,
      });
    }
  }
  return workspaces;
}

export async function GET() {
  try {
    const workspaces = await fetchWorkspacesFromConfig();
    // Map to the format expected by the frontend
    const formatted = workspaces.map((w) => ({
      id: w.workspaceId,
      name: w.name,
      ownerId: w.ownerId,
      members: w.members,
      createdAt: w.createdAt,
    }));
    return Response.json({ workspaces: formatted });
  } catch (e) {
    console.error('Error fetching workspaces:', e);
    return Response.json({ workspaces: [] });
  }
}

export const POST = withApiHandler(async (body) => {
  requireFields(body, 'name', 'ownerId');
  const { createWorkspace } = await import('@claw/core/lib/memory/workspace-operations');
  const workspace = await createWorkspace({
    name: body.name,
    ownerId: body.ownerId,
    ownerDisplayName: body.ownerDisplayName ?? 'Unknown',
  });
  return { success: true, id: workspace.workspaceId };
});
