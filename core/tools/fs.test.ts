import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { fileWrite, fileRead, listFiles } from './fs';
import * as fs from 'fs/promises';

const s3Mock = mockClient(S3Client);

// Mock SST Resource
vi.mock('sst', () => ({
  Resource: {
    StagingBucket: { name: 'test-bucket' },
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

describe('fs tools', () => {
  beforeEach(() => {
    s3Mock.reset();
    vi.clearAllMocks();
  });

  describe('fileWrite', () => {
    it('should write content to a file', async () => {
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const result = await fileWrite.execute({ filePath: 'test.txt', content: 'hello' });

      expect(result).toContain('Successfully wrote to test.txt');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should block protected files', async () => {
      const result = await fileWrite.execute({ filePath: 'sst.config.ts', content: 'hacked' });
      expect(result).toContain('PERMISSION_DENIED');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('fileRead', () => {
    it('should read content from a file', async () => {
      (fs.readFile as any).mockResolvedValue('file content');

      const result = await fileRead.execute({ filePath: 'test.txt' });

      expect(result).toBe('file content');
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('should list files in a directory', async () => {
      (fs.readdir as any).mockResolvedValue(['file1.ts', 'file2.ts']);

      const result = await listFiles.execute({ dirPath: 'src' });

      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
    });
  });
});
