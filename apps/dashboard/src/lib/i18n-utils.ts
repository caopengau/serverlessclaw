import { Locale } from '@/components/Providers/TranslationsProvider';

/**
 * Maps the application locale to a standard BCP 47 language tag for Intl APIs.
 */
export function getLanguageTag(locale: Locale): string {
  switch (locale) {
    case 'cn':
      return 'zh-CN';
    case 'en':
    default:
      return 'en-US';
  }
}

/**
 * Localized date formatter.
 */
export function formatDate(
  date: Date | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString(getLanguageTag(locale), options);
}

/**
 * Localized time formatter.
 */
export function formatTime(
  date: Date | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString(getLanguageTag(locale), options);
}
