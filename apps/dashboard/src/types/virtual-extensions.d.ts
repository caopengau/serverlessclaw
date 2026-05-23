declare module 'virtual-extensions' {
  export function init(hooks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerSidebar: (ext: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerComponent: (ext: any) => void;
  }): void;
}

declare module 'virtual-jobs-config' {
  const config: any[];
  export default config;
}
