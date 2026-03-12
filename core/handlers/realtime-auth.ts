/**
 * Simple authorizer for IoT Realtime bus.
 * For now, we allow any connection for development, but in production,
 * this would verify dashboard session tokens.
 */
export const handler = async (event: any) => {
  console.log('[RealtimeAuth] Authorizing connection:', event);

  return {
    publish: ['*'],
    subscribe: ['*'],
  };
};
