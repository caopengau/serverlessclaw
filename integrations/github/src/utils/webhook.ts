import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies an HMAC signature for a webhook payload.
 * Ported from core to break circular dependency.
 *
 * @param payload - The raw string body of the webhook.
 * @param signature - The signature header value (e.g. sha256=...).
 * @param secret - The configured webhook secret.
 * @param prefix - Optional prefix used in the signature (e.g. 'sha256=').
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  prefix = 'sha256='
): boolean {
  if (!signature) return false;

  try {
    const hmac = createHmac('sha256', secret);
    const digest = Buffer.from(prefix + hmac.update(payload).digest('hex'), 'utf8');
    const checksum = Buffer.from(signature, 'utf8');
    return checksum.length === digest.length && timingSafeEqual(digest, checksum);
  } catch {
    return false;
  }
}
