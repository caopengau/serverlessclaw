import { ITool } from '../../lib/types/index';

/**
 * Tool for agents to render specialized UI components in the dashboard.
 */
export const render_component: ITool = {
  name: 'render_component',
  description:
    'Renders a specialized UI component in the dashboard to provide structured information or enable interactive operations.',
  parameters: {
    type: 'object',
    properties: {
      componentType: {
        type: 'string',
        description:
          'The type of UI component to render (e.g., "operation-card", "deployment-stepper", "diff-viewer").',
      },
      props: {
        type: 'object',
        description: 'The properties for the UI component.',
      },
      actions: {
        type: 'array',
        description: 'Optional list of interactive actions available for the component.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique ID for the action.' },
            label: { type: 'string', description: 'The text displayed on the action button.' },
            type: { type: 'string', enum: ['primary', 'secondary', 'danger'] },
            payload: {
              type: 'object',
              description: 'Optional data to send back when the action is triggered.',
            },
          },
          required: ['id', 'label'],
        },
      },
      title: { type: 'string', description: 'An optional title for the component.' },
      persistent: {
        type: 'boolean',
        description:
          'Whether the component should be pinned to the persistent workspace/artifact panel.',
      },
    },
    required: ['componentType', 'props'],
    additionalProperties: false,
  },
  execute: async (args: Record<string, unknown>) => {
    // This tool is purely instructional for the frontend.
    // The executor will capture the tool call and include it in the response as ui_blocks.
    return {
      text: `UI Component '${args.componentType}' rendered successfully.`,
      ui_blocks: [
        {
          id: `ui_${Date.now()}`,
          componentType: String(args.componentType),
          props: (args.props as Record<string, unknown>) || {},
          actions: (args.actions as Array<Record<string, unknown>> | undefined)?.map((a) => ({
            id: String(a.id),
            label: String(a.label),
            type: (a.type as 'primary' | 'secondary' | 'danger') || 'secondary',
            payload: a.payload as Record<string, unknown> | undefined,
          })),
        },
      ],
    };
  },
};
