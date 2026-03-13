import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { fileUpload, fileDelete, listUploadedFiles } from './fs';

const s3Mock = mockClient(S3Client);

// Mock SST Resource
vi.mock('sst', () => ({
  Resource: {
    StagingBucket: { name: 'test-bucket' },
  },
}));

describe('file management tools', () => {
  beforeEach(() => {
    s3Mock.reset();
    vi.clearAllMocks();
  });

  describe('fileUpload', () => {
    it('should upload a text file to S3 with userId isolation', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await (fileUpload.execute({
        fileName: 'test.txt',
        content: 'hello world',
        userId: 'user-123',
      }) as Promise<string>);

      expect(result).toContain('Successfully uploaded test.txt');
      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'users/user-123/files/test.txt',
        Body: 'hello world',
      });
    });

    it('should handle base64 encoding', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      await fileUpload.execute({
        fileName: 'image.png',
        content: 'YmFzZTY0ZGF0YQ==',
        encoding: 'base64',
        userId: 'user-123',
      });

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls[0].args[0].input.Body).toBeInstanceOf(Buffer);
    });
  });

  describe('fileDelete', () => {
    it('should delete a file from S3', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      const result = await fileDelete.execute({
        fileName: 'test.txt',
        userId: 'user-123',
      });

      expect(result).toContain('Successfully deleted test.txt');
      expect(s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input).toMatchObject({
        Key: 'users/user-123/files/test.txt',
      });
    });
  });

  describe('listUploadedFiles', () => {
    it('should list files for a user', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'users/user-123/files/file1.txt', Size: 1024, LastModified: new Date() },
          { Key: 'users/user-123/files/file2.jpg', Size: 2048, LastModified: new Date() },
        ],
      });

      const result = await listUploadedFiles.execute({
        userId: 'user-123',
      });

      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.jpg');
    });
  });
});
