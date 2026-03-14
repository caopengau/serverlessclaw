import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';

const ddbMock = mockClient(DynamoDBDocumentClient);
const codeBuildMock = mockClient(CodeBuildClient);

const lockMocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  release: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/lock', () => ({
  DynamoLockManager: class {
    acquire = lockMocks.acquire;
    release = lockMocks.release;
  },
}));

vi.mock('sst', () => ({
  Resource: {
    WebhookApi: { url: 'https://test.example.com' },
    Deployer: { name: 'test-deployer' },
    MemoryTable: { name: 'test-memory-table' },
  },
}));

describe('Dead Man Switch Recovery Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    codeBuildMock.reset();
    vi.clearAllMocks();
    // Default: health check returns OK
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  });

  it('should NOT trigger CodeBuild if health check passes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const { handler } = await import('./recovery');
    await handler();
    expect(codeBuildMock.calls()).toHaveLength(0);
  });

  it('should acquire a lock and trigger CodeBuild on health failure', async () => {
    lockMocks.acquire.mockResolvedValue(true);
    ddbMock.on(PutCommand).resolves({});
    codeBuildMock.on(StartBuildCommand).resolves({ build: { id: 'test-build' } });

    const { handler } = await import('./recovery');
    await handler();

    expect(lockMocks.acquire).toHaveBeenCalledWith('dead-mans-switch-recovery', expect.any(Number));
    expect(codeBuildMock.commandCalls(StartBuildCommand)).toHaveLength(1);
    const buildInput = codeBuildMock.commandCalls(StartBuildCommand)[0].args[0].input;
    expect(buildInput.environmentVariablesOverride).toContainEqual(
      expect.objectContaining({ name: 'EMERGENCY_ROLLBACK', value: 'true' })
    );
  });

  it('should NOT trigger CodeBuild if lock is already held (idempotency)', async () => {
    lockMocks.acquire.mockResolvedValue(false); // Lock already held

    const { handler } = await import('./recovery');
    await handler();

    expect(codeBuildMock.commandCalls(StartBuildCommand)).toHaveLength(0);
  });

  it('should release lock on CodeBuild failure so next check can retry', async () => {
    lockMocks.acquire.mockResolvedValue(true);
    codeBuildMock.on(StartBuildCommand).rejects(new Error('CodeBuild unavailable'));

    const { handler } = await import('./recovery');
    await handler();

    expect(lockMocks.release).toHaveBeenCalledWith('dead-mans-switch-recovery');
  });
});
