import { describe, it, expect } from 'vitest';
import { handler } from './realtime-auth';

describe('Realtime Auth Handler', () => {
  it('returns correctly formatted custom authorizer response', async () => {
    const event = {
      protocolData: { mqtt: { clientId: 'dashboard-123' } },
    };

    const response = await handler(event);

    // Ensure the principalId is perfectly alphanumeric to satisfy AWS IoT Core
    expect(response.principalId).toBe('dashboardUser');
    expect(response.principalId).toMatch(/^[a-zA-Z0-9]+$/);

    expect(response.isAuthenticated).toBe(true);
    expect(response.disconnectAfterInSeconds).toBe(3600);
    expect(response.refreshAfterInSeconds).toBe(300);

    // Crucially, policyDocuments must be an array of JSON stringified policies
    expect(Array.isArray(response.policyDocuments)).toBe(true);
    expect(typeof response.policyDocuments[0]).toBe('string');

    const policy = JSON.parse(response.policyDocuments[0]);

    expect(policy.Version).toBe('2012-10-17');
    expect(Array.isArray(policy.Statement)).toBe(true);

    // Verify separation of statements to avoid AWS IoT strict IAM failures
    const connectStatement = policy.Statement.find((s: any) => s.Action === 'iot:Connect');
    expect(connectStatement.Resource).toBe('arn:aws:iot:*:*:client/*');

    const pubRecvStatement = policy.Statement.find(
      (s: any) => Array.isArray(s.Action) && s.Action.includes('iot:Publish')
    );
    expect(pubRecvStatement.Resource).toBe('arn:aws:iot:*:*:topic/*');

    const subStatement = policy.Statement.find((s: any) => s.Action === 'iot:Subscribe');
    expect(subStatement.Resource).toBe('arn:aws:iot:*:*:topicfilter/*');
  });
});
