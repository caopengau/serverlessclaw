/**
 * Native filesystem tools for coder agents running in Lambda.
 * These tools operate directly on process.cwd() (the ephemeral workspace)
 * without requiring MCP servers, which are not available in Lambda.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../lib/logger';
import { formatErrorMessage } from '../../lib/utils/error';

const MAX_READ_BYTES = 256 * 1024; // 256 KB safety cap

function resolveWorkspacePath(relPath: string): string {
  const workspace = process.cwd();
  const resolved = path.resolve(workspace, relPath);
  // Security: prevent path traversal outside workspace
  if (!resolved.startsWith(workspace)) {
    throw new Error(`Path traversal denied: ${relPath}`);
  }
  return resolved;
}

export const filesystem_read_file = {
  name: 'filesystem_read_file',
  description:
    'Read the contents of a file in the current workspace. Returns file content as a string. Path is relative to workspace root.',
  parameters: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file within the workspace (e.g. "src/index.ts")',
      },
      encoding: {
        type: 'string',
        enum: ['utf8', 'base64'],
        description: 'Encoding to use (default: utf8)',
      },
    },
    required: ['path'],
  },
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const filePath = String(args.path);
      const encoding = (args.encoding as BufferEncoding | undefined) || 'utf8';
      const resolved = resolveWorkspacePath(filePath);

      const stat = await fs.stat(resolved);
      if (stat.size > MAX_READ_BYTES) {
        const truncated = await fs.readFile(resolved);
        return (
          `[TRUNCATED: file is ${stat.size} bytes, showing first ${MAX_READ_BYTES} bytes]\n` +
          truncated.subarray(0, MAX_READ_BYTES).toString(encoding)
        );
      }

      const content = await fs.readFile(resolved, { encoding });
      return content;
    } catch (error) {
      return `ERROR reading file: ${formatErrorMessage(error)}`;
    }
  },
};

export const filesystem_write_file = {
  name: 'filesystem_write_file',
  description:
    'Write content to a file in the current workspace. Creates parent directories as needed. Path is relative to workspace root.',
  parameters: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file within the workspace (e.g. "src/index.ts")',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const filePath = String(args.path);
      const content = String(args.content);
      const resolved = resolveWorkspacePath(filePath);

      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf8');

      logger.info(`[workspaceWriteFile] Wrote ${content.length} bytes to ${filePath}`);
      return `SUCCESS: wrote ${content.length} characters to ${filePath}`;
    } catch (error) {
      return `ERROR writing file: ${formatErrorMessage(error)}`;
    }
  },
};

export const filesystem_list_directory = {
  name: 'filesystem_list_directory',
  description:
    'List the contents of a directory in the current workspace. Returns a JSON array of file and directory names.',
  parameters: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the directory (use "." for workspace root)',
      },
    },
    required: ['path'],
  },
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const dirPath = String(args.path || '.');
      const resolved = resolveWorkspacePath(dirPath);

      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const result = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `ERROR listing directory: ${formatErrorMessage(error)}`;
    }
  },
};

export const filesystem_search_files = {
  name: 'filesystem_search_files',
  description:
    'Search for files in the workspace that contain a given text pattern. Returns matching file paths and matching lines. Equivalent to grep -r.',
  parameters: {
    type: 'object' as const,
    properties: {
      pattern: {
        type: 'string',
        description: 'Text pattern to search for',
      },
      directory: {
        type: 'string',
        description:
          'Subdirectory to search in (relative to workspace root, default: "." = entire workspace)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of matching lines to return (default: 50)',
      },
    },
    required: ['pattern'],
  },
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const pattern = String(args.pattern);
      const directory = String(args.directory || '.');
      const maxResults = Number(args.maxResults || 50);
      const searchDir = resolveWorkspacePath(directory);

      const results: string[] = [];
      let count = 0;

      async function searchDir_(dir: string): Promise<void> {
        if (count >= maxResults) return;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (count >= maxResults) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.sst'].includes(entry.name)) {
              await searchDir_(fullPath);
            }
          } else if (entry.isFile()) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(pattern)) {
                  const relPath = path.relative(process.cwd(), fullPath);
                  results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                  count++;
                  if (count >= maxResults) break;
                }
              }
            } catch {
              // Skip binary files or unreadable files
            }
          }
        }
      }

      await searchDir_(searchDir);

      if (results.length === 0) return `No matches found for pattern: ${pattern}`;
      return (
        results.join('\n') +
        (count >= maxResults ? `\n[... truncated at ${maxResults} results]` : '')
      );
    } catch (error) {
      return `ERROR searching files: ${formatErrorMessage(error)}`;
    }
  },
};
