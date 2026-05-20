/**
 * VoltX Integration Plugin
 *
 * This plugin is exported and loaded dynamically via the core framework's
 * plugin system. Register this module using the CLAW_OPTIONAL_PLUGIN_MODULES
 * environment variable.
 */

import { voltxPlugin } from './src/index';

export { voltxPlugin };
export default voltxPlugin;
