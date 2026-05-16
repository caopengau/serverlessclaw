/**
 * Generic Extension Hub
 *
 * Products can register sidebar items and components here.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function init(_config: {
  _registerSidebar: (config: unknown) => void;
  _registerComponent: (config: unknown) => void;
}) {
  // Hub is initialized empty; products inject logic via this hook.
}
