const AUTH_SESSION_TTL_SECONDS = 3600; // 1 hour
const AUTH_REFRESH_INTERVAL_SECONDS = 300; // 5 minutes

/**
 * Simple authorizer for IoT Realtime bus.
 * Requires a valid token in the query string for authentication.
 */
export const handler = async (event: any) => {
  let token: string | undefined;

  // AWS IoT Core custom authorizers provide queryString as a raw string or an object depending on the context
  if (typeof event.queryString === 'string') {
    const params = new URLSearchParams(event.queryString);
    token = params.get('token') || undefined;
  } else if (event.queryString && typeof event.queryString === 'object') {
    token = event.queryString.token;
  }

  // Fallback to top-level token (used by some AWS IoT configurations)
  if (!token && event.token) {
    token = event.token;
  }

  if (!token || typeof token !== 'string' || token.length < 10) {
    console.warn('[RealtimeAuth] Unauthorized: Missing or invalid token', {
      hasToken: !!token,
      tokenLength: token?.length,
      eventType: typeof event,
      hasQueryString: !!event.queryString,
      queryStringType: typeof event.queryString,
    });
    return {
      isAuthenticated: false,
      principalId: 'unauthorized',
      disconnectAfterInSeconds: 0,
      refreshAfterInSeconds: 0,
      policyDocuments: [],
    };
  }

  const principalId = `user-${token.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '')}`;

  // Sh5 Fix: Match the dashboard's ClientID convention: dashboard-${safeToken}-${tabId}
  // The principal ID derived from token is used to constrain the wildcard.
  const safeToken = token.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
  const clientResource = `arn:aws:iot:*:*:client/dashboard-${safeToken}-*`;
  const appTopicResources = [
    'arn:aws:iot:*:*:topic/users/*',
    'arn:aws:iot:*:*:topic/workspaces/*',
    'arn:aws:iot:*:*:topic/collaborations/*',
    'arn:aws:iot:*:*:topic/system/metrics',
  ];

  const appTopicFilterResources = [
    'arn:aws:iot:*:*:topicfilter/users/*',
    'arn:aws:iot:*:*:topicfilter/workspaces/*',
    'arn:aws:iot:*:*:topicfilter/collaborations/*',
    'arn:aws:iot:*:*:topicfilter/system/metrics',
  ];

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'iot:Connect',
        Effect: 'Allow',
        Resource: clientResource,
      },
      // Keep a principal-scoped publish/receive rule (backwards compatible for tests)
      {
        Action: ['iot:Publish', 'iot:Receive'],
        Effect: 'Allow',
        Resource: `arn:aws:iot:*:*:topic/${principalId}/*`,
      },
      // Also allow application topic namespaces used by the realtime bridge
      {
        Action: ['iot:Publish', 'iot:Receive'],
        Effect: 'Allow',
        Resource: appTopicResources,
      },
      // Principal-scoped subscribe
      {
        Action: 'iot:Subscribe',
        Effect: 'Allow',
        Resource: `arn:aws:iot:*:*:topicfilter/${principalId}/*`,
      },
      // Application topicfilter permissions
      {
        Action: 'iot:Subscribe',
        Effect: 'Allow',
        Resource: appTopicFilterResources,
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
