/**
 * Generic Extension Hub
 *
 * This file is a bridge between the ServerlessClaw framework and project-specific extensions.
 * It dynamically attempts to load extensions from the 'project' subdirectory if present.
 */

export async function init(hubConfig: {
  registerSidebarExtension: (config: any) => void;
  registerDynamicComponent: (config: any) => void;
  registerLayoutExtension: (config: any) => void;
}) {
  console.debug('[Hub] Initializing extension discovery...');

  try {
    // Attempt to load the project-specific extension entry point.
    // The build process copies the project's dashboard code into this subdirectory.
    // @ts-ignore - Dynamic import path that may not exist during framework-only builds
    const projectExt = await import('./project/index');
    
    if (projectExt && typeof projectExt.init === 'function') {
      console.info('[Hub] Project extensions detected. Initializing...');
      await projectExt.init(hubConfig);
    }
  } catch (error) {
    // Silently ignore if no project extensions are found
    console.debug('[Hub] No project-specific extensions found in ./project/');
  }
}
