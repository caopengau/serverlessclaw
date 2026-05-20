/**
 * GoldEx Integration Plugin
 *
 * This plugin is exported and loaded dynamically via the core framework's
 * plugin system. Register this module using the CLAW_OPTIONAL_PLUGIN_MODULES
 * environment variable.
 */

import { goldexPlugin } from './src/index';

export { goldexPlugin };
export default goldexPlugin;
