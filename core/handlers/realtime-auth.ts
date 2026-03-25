/**
 * Simple authorizer for IoT Realtime bus.
 */
export const handler = async (event: any) => {
  console.log('[RealtimeAuth] Authorizing connection:', JSON.stringify(event, null, 2));

  // Use a stable principalId for the dashboard (must be alphanumeric)
  const principalId = 'dashboardUser';

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'iot:Connect',
        Effect: 'Allow',
        Resource: 'arn:aws:iot:*:*:client/*',
      },
      {
        Action: ['iot:Publish', 'iot:Receive'],
        Effect: 'Allow',
        Resource: 'arn:aws:iot:*:*:topic/*',
      },
      {
        Action: 'iot:Subscribe',
        Effect: 'Allow',
        Resource: 'arn:aws:iot:*:*:topicfilter/*',
      },
    ],
  };

  const response = {
    isAuthenticated: true,
    principalId,
    disconnectAfterInSeconds: 3600,
    refreshAfterInSeconds: 300,
    policyDocuments: [JSON.stringify(policy)],
  };

  console.log('[RealtimeAuth] Returning response:', JSON.stringify(response, null, 2));
  return response;
};
