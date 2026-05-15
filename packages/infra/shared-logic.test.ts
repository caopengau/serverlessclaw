import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the global $app variable before importing the module under test
vi.stubGlobal('$app', {
  stage: 'prod',
  name: 'serverlessclaw',
});

// Mock the sst global for cloudflare.dns
vi.stubGlobal('sst', {
  cloudflare: {
    dns: vi.fn().mockReturnValue({ type: 'cloudflare-dns' }),
  },
});

import { getDomainConfig } from './shared';

describe('infra/shared logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env for each test
    delete process.env.CLAW_DOMAIN_API;
    delete process.env.CLAW_DOMAIN_DASHBOARD;
    delete process.env.CLAW_DOMAIN_ROUTER;
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.ACM_CERTIFICATE_ARN;
  });

  describe('getDomainConfig', () => {
    it('should return undefined (BYPASSED)', () => {
      vi.stubGlobal('$app', { stage: 'dev' });
      const config = getDomainConfig('api');
      expect(config).toBeUndefined();
    });

    it('should return undefined even in prod (BYPASSED)', () => {
      vi.stubGlobal('$app', { stage: 'prod' });
      process.env.CLAW_DOMAIN_API = 'api.example.com';
      process.env.CLOUDFLARE_ZONE_ID = 'zone123';

      const config = getDomainConfig('api');
      expect(config).toBeUndefined();
    });
  });
});
