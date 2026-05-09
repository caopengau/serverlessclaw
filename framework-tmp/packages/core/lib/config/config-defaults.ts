/**
 * Centralized Configuration Defaults
 *
 * This module provides a single source of truth for all configurable system defaults.
 */

import { EVOLUTION_DEFAULTS } from './defaults/evolution';
import { AGENT_DEFAULTS } from './defaults/agent';
import { CONTEXT_DEFAULTS } from './defaults/context';
import { BUS_DEFAULTS } from './defaults/bus';
import { MEMORY_DEFAULTS } from './defaults/memory';
import { INFRASTRUCTURE_DEFAULTS } from './defaults/infrastructure';

export const CONFIG_DEFAULTS = {
  ...EVOLUTION_DEFAULTS,
  ...AGENT_DEFAULTS,
  ...CONTEXT_DEFAULTS,
  ...BUS_DEFAULTS,
  ...MEMORY_DEFAULTS,
  ...INFRASTRUCTURE_DEFAULTS,
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export function getConfigValue<K extends ConfigKey>(
  key: K,
  runtimeValue?: unknown
): (typeof CONFIG_DEFAULTS)[K]['code'] {
  return (runtimeValue ?? CONFIG_DEFAULTS[key].code) as (typeof CONFIG_DEFAULTS)[K]['code'];
}

export function getHotSwappableKeys(): Array<{ key: ConfigKey; configKey: string }> {
  return Object.entries(CONFIG_DEFAULTS)
    .filter(([, def]) => (def as any).hotSwappable && (def as any).configKey)
    .map(([key, def]) => ({
      key: key as ConfigKey,
      configKey: (def as any).configKey!,
    }));
}
