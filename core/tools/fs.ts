import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Resource } from 'sst';
import { toolDefinitions } from './definitions';
import { logger } from '../lib/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PROTECTED_FILES } from '../lib/constants';
import { ToolResult } from '../lib/types/tool';

const execAsync = promisify(exec);
const s3 = new S3Client({});

interface ToolsResource {
  StagingBucket: { name: string };
}

/**
 * Uploads a file to the agent's persistent S3 storage.
 */
export const fileUpload = {
  ...toolDefinitions.fileUpload,
  execute: async (args: Record<string, unknown>): Promise<ToolResult | string> => {
    const {
      fileName,
      content,
      encoding = 'text',
      userId,
    } = args as {
      fileName: string;
      content: string;
      encoding?: 'text' | 'base64';
      userId: string;
    };

    if (!userId) return 'FAILED: No userId provided for storage mapping.';

    const typedResource = Resource as unknown as ToolsResource;
    const bucketName = typedResource.StagingBucket.name;
    const s3Key = `users/${userId}/files/${fileName}`;

    try {
      const body = encoding === 'base64' ? Buffer.from(content, 'base64') : content;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: body,
        })
      );

      return `Successfully uploaded ${fileName} to persistent storage.`;
    } catch (error) {
      return `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Deletes a file from the agent's persistent S3 storage.
 */
export const fileDelete = {
  ...toolDefinitions.fileDelete,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { fileName, userId } = args as { fileName: string; userId: string };
    if (!userId) return 'FAILED: No userId provided.';

    const typedResource = Resource as unknown as ToolsResource;
    const s3Key = `users/${userId}/files/${fileName}`;

    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: typedResource.StagingBucket.name,
          Key: s3Key,
        })
      );
      return `Successfully deleted ${fileName}.`;
    } catch (error) {
      return `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Lists all uploaded files for the user.
 */
export const listUploadedFiles = {
  ...toolDefinitions.listUploadedFiles,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { userId } = args as { userId: string };
    if (!userId) return 'FAILED: No userId provided.';

    const typedResource = Resource as unknown as ToolsResource;
    const prefix = `users/${userId}/files/`;

    try {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: typedResource.StagingBucket.name,
          Prefix: prefix,
        })
      );

      if (!response.Contents || response.Contents.length === 0) {
        return 'No files found in your persistent storage.';
      }

      return response.Contents.map((obj) => {
        const name = obj.Key?.replace(prefix, '');
        return `- ${name} (${(obj.Size || 0) / 1024} KB, Last Modified: ${obj.LastModified?.toISOString()})`;
      }).join('\n');
    } catch (error) {
      return `Failed to list files: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Stages modified files to S3 for a new deployment.
...
export const stageChanges = {
  ...toolDefinitions.stageChanges,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { modifiedFiles } = args as { modifiedFiles: string[] };
    if (!modifiedFiles || modifiedFiles.length === 0) {
      return 'No files to stage.';
    }

    const typedResource = Resource as unknown as ToolsResource;
    const zipPath = STORAGE.TMP_STAGING_ZIP;
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve) => {
      output.on('close', async () => {
        try {
          const fileBuffer = await fs.readFile(zipPath);
          await s3.send(
            new PutObjectCommand({
              Bucket: typedResource.StagingBucket.name,
              Key: STORAGE.STAGING_ZIP,
              Body: fileBuffer,
            })
          );
          resolve(`Successfully staged ${modifiedFiles.length} files to S3.`);
        } catch (error) {
          resolve(
            `Failed to upload staged changes: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      });

      archive.on('error', (err: Error) => {
        resolve(`Failed to create zip: ${err.message}`);
      });

      archive.pipe(output);
      for (const file of modifiedFiles as string[]) {
        const fullPath = path.resolve(process.cwd(), file);
        archive.file(fullPath, { name: file });
      }
      archive.finalize();
    });
  },
};

/**
 * Writes content to a file, with protection for critical system files.
 */
export const fileWrite = {
  ...toolDefinitions.fileWrite,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { filePath, content } = args as { filePath: string; content: string };

    let protectedList: string[] = [...PROTECTED_FILES];
    try {
      const { AgentRegistry } = await import('../lib/registry');
      const ddbProtected = (await AgentRegistry.getRawConfig('protected_resources')) as string[];
      if (ddbProtected && Array.isArray(ddbProtected)) {
        protectedList = ddbProtected;
      }
    } catch {
      logger.warn('Failed to fetch protected_resources from DDB, using hardcoded defaults.');
    }

    const isProtected =
      protectedList.some((f) => (filePath as string).endsWith(f)) ||
      (filePath as string).includes('infra/');

    if (isProtected) {
      return `PERMISSION_DENIED: The file '${filePath}' is labeled as [PROTECTED]. Autonomous modification is blocked. Please present the proposed changes to the user and request a 'MANUAL_APPROVAL'.`;
    }

    try {
      const fullPath = path.resolve(process.cwd(), filePath as string);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content as string, 'utf8');
      return `Successfully wrote to ${filePath}`;
    } catch (error) {
      return `Failed to write file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Reads the content of a file from the local file system.
 */
export const fileRead = {
  ...toolDefinitions.fileRead,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { filePath } = args as { filePath: string };
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      return `Failed to read file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Lists all files in a specific directory.
 * @deprecated Use MCP filesystem server instead.
 */
export const listFiles = {
  ...toolDefinitions.listFiles,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { dirPath } = args as { dirPath?: string };
    try {
      const targetDir = dirPath ? path.resolve(process.cwd(), dirPath) : process.cwd();
      const files = await promisify(require('fs').readdir)(targetDir);
      return files.join('\n');
    } catch (error) {
      return `Failed to list files: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Executes an arbitrary shell command in a given directory.
 */
export const runShellCommand = {
  ...toolDefinitions.runShellCommand,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { command, dir_path } = args as { command: string; dir_path?: string };
    try {
      logger.info(`Executing shell command: ${command} in ${dir_path || 'root'}`);
      const { stdout, stderr } = await execAsync(command, {
        cwd: dir_path ? path.resolve(process.cwd(), dir_path) : process.cwd(),
      });
      return `Output:\n${stdout}\n${stderr}`;
    } catch (error) {
      return `Execution FAILED:\n${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Runs the autonomous test suite using 'npm test'.
 */
export const runTests = {
  ...toolDefinitions.runTests,
  execute: async (): Promise<string> => {
    try {
      logger.info('Running autonomous test suite...');
      const { stdout, stderr } = await execAsync('npm test');
      return `Test Results:\n${stdout}\n${stderr}`;
    } catch (error) {
      return `Tests FAILED:\n${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
