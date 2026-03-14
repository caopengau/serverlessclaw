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

const memoryMocks = vi.hoisted(() => ({
  getLatestLKGHash: vi.fn(),
}));

vi.mock('../lib/memory', () => ({
  DynamoMemory: class {
    getLatestLKGHash = memoryMocks.getLatestLKGHash;
  },
}));

vi.mock('sst', () => ({
  Resource: {
    WebhookApi: { url: 'https://test.example.com' },
    Deployer: { name: 'test-deployer' },
    MemoryTable: { name: 'test-memory-table' },
    AgentBus: { name: 'test-bus' }, // Added AgentBus for deep check mock
  },
}));

describe('Dead Man Switch Recovery Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    codeBuildMock.reset();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  });

  it('should NOT trigger CodeBuild if health check passes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const { handler } = await import('./recovery');
    await handler();
    expect(codeBuildMock.calls()).toHaveLength(0);
  });

  it('should retrieve LKG hash and trigger CodeBuild on health failure', async () => {
    lockMocks.acquire.mockResolvedValue(true);
    memoryMocks.getLatestLKGHash.mockResolvedValue('lkg-commit-123');
    ddbMock.on(PutCommand).resolves({});
    codeBuildMock.on(StartBuildCommand).resolves({ build: { id: 'test-build' } });

    const { handler } = await import('./recovery');
    await handler();

    expect(memoryMocks.getLatestLKGHash).toHaveBeenCalled();
    expect(codeBuildMock.commandCalls(StartBuildCommand)).toHaveLength(1);
    const buildInput = codeBuildMock.commandCalls(StartBuildCommand)[0].args[0].input;
    expect(buildInput.environmentVariablesOverride).toContainEqual(
      expect.objectContaining({ name: 'LKG_HASH', value: 'lkg-commit-123' })
    );
    expect(buildInput.environmentVariablesOverride).toContainEqual(
      expect.objectContaining({ name: 'EMERGENCY_ROLLBACK', value: 'true' })
    );
  });

  it('should fallback to empty LKG_HASH if none found in memory', async () => {
    lockMocks.acquire.mockResolvedValue(true);
    memoryMocks.getLatestLKGHash.mockResolvedValue(null);
    ddbMock.on(PutCommand).resolves({});
    codeBuildMock.on(StartBuildCommand).resolves({ build: { id: 'test-build' } });

    const { handler } = await import('./recovery');
    await handler();

    const buildInput = codeBuildMock.commandCalls(StartBuildCommand)[0].args[0].input;
    expect(buildInput.environmentVariablesOverride).toContainEqual(
      expect.objectContaining({ name: 'LKG_HASH', value: '' })
    );
  });
});
