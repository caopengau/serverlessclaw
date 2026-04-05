import { describe, it, expect } from 'vitest';
import { render_component } from './ui';

interface ToolResultWithUI {
  text: string;
  ui_blocks: Array<{
    id: string;
    componentType: string;
    props: Record<string, unknown>;
    actions?: Array<{
      id: string;
      label: string;
      type: string;
      payload?: Record<string, unknown>;
    }>;
  }>;
}

describe('system/tools/ui', () => {
  describe('render_component', () => {
    it('should return success message with UI block', async () => {
      const result = (await render_component.execute({
        componentType: 'operation-card',
        props: { title: 'Test', status: 'success' },
      })) as ToolResultWithUI;

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('ui_blocks');
      expect(result.ui_blocks).toHaveLength(1);
      expect(result.ui_blocks[0]).toMatchObject({
        componentType: 'operation-card',
        props: { title: 'Test', status: 'success' },
      });
    });

    it('should handle actions array', async () => {
      const result = (await render_component.execute({
        componentType: 'diff-viewer',
        props: { diff: 'some diff' },
        actions: [
          { id: 'approve', label: 'Approve', type: 'primary' },
          { id: 'reject', label: 'Reject', type: 'danger' },
        ],
      })) as ToolResultWithUI;

      expect(result.ui_blocks[0].actions).toHaveLength(2);
      expect(result.ui_blocks[0].actions?.[0]).toMatchObject({
        id: 'approve',
        label: 'Approve',
        type: 'primary',
      });
    });

    it('should use default action type when not specified', async () => {
      const result = (await render_component.execute({
        componentType: 'test',
        props: {},
        actions: [{ id: 'action1', label: 'Action' }],
      })) as ToolResultWithUI;

      expect(result.ui_blocks[0].actions?.[0].type).toBe('secondary');
    });

    it('should handle optional title in args', async () => {
      const result = (await render_component.execute({
        componentType: 'test',
        props: {},
        title: 'My Component',
      })) as ToolResultWithUI;

      expect(result.ui_blocks[0]).toHaveProperty('componentType', 'test');
      expect(result.text).toContain('test');
    });
  });
});
