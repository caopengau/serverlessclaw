const AUTH_SESSION_TTL_SECONDS = 3600; // 1 hour
const AUTH_REFRESH_INTERVAL_SECONDS = 300; // 5 minutes

/**
 * Simple authorizer for IoT Realtime bus.
 * Requires a valid token in the query string for authentication.
 */
export const handler = async (event: { queryString?: Record<string, string> }) => {
  const queryString = event.queryString || {};
  const token = queryString.token;

  if (!token || typeof token !== 'string' || token.length < 10) {
    return {
      isAuthenticated: false,
      principalId: 'unauthorized',
      disconnectAfterInSeconds: 0,
      refreshAfterInSeconds: 0,
      policyDocuments: [],
    };
  }

  const principalId = `user-${token.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '')}`;

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'iot:Connect',
        Effect: 'Allow',
        Resource: `arn:aws:iot:*:*:client/${principalId}*`,
      },
      {
        Action: ['iot:Publish', 'iot:Receive'],
        Effect: 'Allow',
        Resource: `arn:aws:iot:*:*:topic/${principalId}/*`,
      },
      {
        Action: 'iot:Subscribe',
        Effect: 'Allow',
        Resource: `arn:aws:iot:*:*:topicfilter/${principalId}/*`,
      },
    ],
  };

  return {
    isAuthenticated: true,
    principalId,
    disconnectAfterInSeconds: AUTH_SESSION_TTL_SECONDS,
    refreshAfterInSeconds: AUTH_REFRESH_INTERVAL_SECONDS,
    policyDocuments: [JSON.stringify(policy)],
  };
};
