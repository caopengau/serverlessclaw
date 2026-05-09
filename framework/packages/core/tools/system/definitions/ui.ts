import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const uiSchema: Record<string, IToolDefinition> = {
  renderComponent: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'renderComponent',
    description:
      'Renders a specialized UI component in the dashboard to provide structured information or enable interactive operations.',
    parameters: {
      type: 'object',
      properties: {
        componentType: {
          type: 'string',
          description:
            'The type of UI component to render (e.g., "operation-card", "status-flow", "resource-preview").',
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
  },
  navigateTo: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'navigateTo',
    description:
      'Navigates the user to a specific path in the dashboard. STRICTLY restricted to SuperClaw.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The relative path to navigate to (e.g., "/traces", "/topology").',
        },
        params: {
          type: 'object',
          description: 'Optional query parameters for the target route.',
        },
        mode: {
          type: 'string',
          enum: ['auto', 'hitl'],
          description:
            'Navigation mode. "auto" navigates immediately (use sparingly). "hitl" (Human-in-the-Loop) shows a navigation button for the user to click.',
        },
      },
      required: ['path', 'mode'],
      additionalProperties: false,
    },
  },
  uiAction: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'uiAction',
    description: 'Triggers a specific UI event or state change in the current dashboard view.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['open_modal', 'close_modal', 'focus_resource', 'toggle_sidebar'],
          description: 'The type of UI action to perform.',
        },
        target: {
          type: 'string',
          description: 'The ID or selector of the target element or resource.',
        },
        payload: {
          type: 'object',
          description: 'Optional data for the UI action.',
        },
      },
      required: ['action', 'target'],
      additionalProperties: false,
    },
  },
  renderCodeDiff: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'renderCodeDiff',
    description:
      'Renders a code diff/patch component in the dashboard for code review and interaction.',
    parameters: {
      type: 'object',
      properties: {
        fileName: { type: 'string', description: 'The name of the file being changed.' },
        language: { type: 'string', description: 'The programming language of the file.' },
        description: { type: 'string', description: 'A short description of the changes.' },
        lines: {
          type: 'array',
          description: 'The list of diff lines to display.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['added', 'removed', 'context'] },
              content: { type: 'string' },
              lineNumber: { type: 'number' },
            },
            required: ['type', 'content'],
          },
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string', enum: ['primary', 'secondary', 'danger'] },
              payload: { type: 'object' },
            },
            required: ['id', 'label'],
          },
        },
      },
      required: ['fileName', 'lines'],
      additionalProperties: false,
    },
  },
  renderPlanEditor: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'renderPlanEditor',
    description:
      'Renders an interactive JSON editor for strategic plans, allowing users to tweak plans before approval.',
    parameters: {
      type: 'object',
      properties: {
        planId: { type: 'string', description: 'The unique ID of the plan.' },
        content: { type: 'object', description: 'The JSON content of the plan.' },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string', enum: ['primary', 'secondary', 'danger'] },
              payload: { type: 'object' },
            },
            required: ['id', 'label'],
          },
        },
      },
      required: ['planId', 'content'],
      additionalProperties: false,
    },
  },
};
