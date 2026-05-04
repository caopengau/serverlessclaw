/**
 * ServerlessClaw Dashboard Extensions
 * This file is the bridge between the framework and VoltX.
 */

// @ts-expect-error - External VoltX UI package may not be present in base framework build
import { init as initVoltX } from '@voltx/ui';

export function init(registry: unknown) {
  // Initialize VoltX energy extensions
  initVoltX(registry);
}
