import { ITool } from '../../lib/types/tool';

/**
 * Collaboration Domain Tool Registry
 */
export const collaborationTools: Record<string, ITool> = {};

/**
 * Lazily loads all collaboration tools.
 */
export async function getCollaborationTools(): Promise<Record<string, ITool>> {
  if (Object.keys(collaborationTools).length > 0) return collaborationTools;

  const [workspace, collaboration, messaging, clarification, shareResource] = await Promise.all([
    import('./workspace'),
    import('./collaboration'),
    import('./messaging'),
    import('./clarification'),
    import('./share-resource'),
  ]);

  Object.assign(collaborationTools, {
    ...workspace,
    ...collaboration,
    ...messaging,
    ...clarification,
    ...shareResource,
  });

  return collaborationTools;
}

export { collaborationSchema } from './schema';
