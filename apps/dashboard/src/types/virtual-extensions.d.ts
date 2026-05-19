declare module 'virtual-extensions' {
  export function init(config: {
    registerSidebar: (config: unknown) => void;
    registerComponent: (config: unknown) => void;
  }): void;
}
