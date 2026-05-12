import { describe, it, expect } from 'vitest';
import { getLanguageTag, formatDate, formatTime } from './i18n-utils';

describe('i18n-utils', () => {
  describe('getLanguageTag', () => {
    it('should map internal locale keys correctly', () => {
      expect(getLanguageTag('en')).toBe('en-US');
      expect(getLanguageTag('cn')).toBe('zh-CN');
    });

    it('should fallback to en-US for unknown locales', () => {
      // @ts-expect-error - testing invalid input
      expect(getLanguageTag('fr')).toBe('en-US');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getLanguageTag(null as any)).toBe('en-US');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2026-05-12T10:00:00Z');

    it('should format dates for English locale', () => {
      const formatted = formatDate(testDate, 'en');
      expect(formatted).toContain('5/12/2026');
    });

    it('should format dates for Chinese locale', () => {
      const formatted = formatDate(testDate, 'cn');
      expect(formatted).toContain('2026/5/12');
    });

    it('should accept number timestamps', () => {
      const timestamp = testDate.getTime();
      expect(formatDate(timestamp, 'en')).toBe(formatDate(testDate, 'en'));
    });
  });

  describe('formatTime', () => {
    const testTime = new Date('2026-05-12T15:30:00'); // Local time

    it('should format time for English locale', () => {
      const formatted = formatTime(testTime, 'en');
      // toLocaleTimeString format can vary slightly by environment, so we check for components
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
      expect(formatted).toMatch(/AM|PM/);
    });

    it('should format time for Chinese locale', () => {
      const formatted = formatTime(testTime, 'cn');
      // Chinese locale usually has 上午/下午 or 24h format depending on environment,
      // but the standard zh-CN toLocaleTimeString with hour12 usually includes characters.
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should respect custom options', () => {
      const formatted = formatTime(testTime, 'en', { hour12: false });
      expect(formatted).not.toMatch(/AM|PM/);
      expect(formatted).toContain('15:30');
    });
  });
});
