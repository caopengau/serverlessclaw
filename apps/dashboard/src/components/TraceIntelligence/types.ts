import { TranslationKey } from '../Providers/TranslationsProvider';

export type TabType = 'timeline' | 'sessions' | 'models' | 'tools' | 'agents' | 'live';
export type TranslationFn = (key: TranslationKey) => string;
