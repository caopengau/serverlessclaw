import { PROTECTED_FILES } from '../constants';

/**
 * Checks if a file path is protected based on the system's PROTECTED_FILES list.
 *
 * @param filePath - The path to the file to check.
 * @returns True if the file path is protected, otherwise false.
 * @since 2026-03-19
 */
export function isProtectedPath(filePath: string): boolean {
  if (!filePath) return false;

  const normalized = filePath.replace(/\\/g, '/');

  // 1. Authoritative Directory Protection (Secure-by-Default)
  const PROTECTED_DIRS = ['core/', 'infra/', 'docs/governance/', '.github/', '.antigravity/'];

  if (PROTECTED_DIRS.some((dir) => normalized.startsWith(dir))) {
    return true;
  }

  // 2. Critical Files Protection
  const CRITICAL_FILES = [
    'sst.config.ts',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '.env',
  ];

  if (CRITICAL_FILES.some((file) => normalized === file || normalized.endsWith(`/${file}`))) {
    return true;
  }

  // 3. Dynamic PROTECTED_FILES from constants as fallback
  try {
    const protectedFiles = PROTECTED_FILES ?? [];
    return protectedFiles.some((p: string) => {
      if (p.endsWith('/**')) {
        const prefix = p.slice(0, -3);
        return normalized.startsWith(prefix);
      }
      if (p.endsWith('/')) {
        return normalized.startsWith(p);
      }
      return normalized === p;
    });
  } catch {
    return false;
  }
}

/**
 * Scans a set of tool arguments for common path keys and validates them for security.
 * Returns the first error found, or null if all paths are safe.
 *
 * Performance optimized: only scans string values that match path heuristics.
 *
 * @param args - The arguments object to scan.
 * @param operationName - Context for error messages.
 * @param extraPathKeys - Additional keys provided by tool metadata that contain file paths.
 */
export function checkArgumentsForSecurity(
  args: Record<string, unknown>,
  operationName: string,
  extraPathKeys: string[] = []
): string | null {
  const pathKeys = [
    'path',
    'path_to_file',
    'file_path',
    'filePath',
    'source',
    'destination',
    'dir',
    'dir_path',
    'dirPath',
    'filename',
    'file',
  ];

  const allKeys = [...new Set([...pathKeys, ...extraPathKeys])];

  // 1. Scan explicit path keys (Fast Path)
  for (const key of allKeys) {
    const filePath = args[key];
    if (filePath && typeof filePath === 'string') {
      const securityError = checkFileSecurity(
        filePath,
        args.manuallyApproved as boolean | undefined,
        `${operationName} [arg: ${key}]`
      );
      if (securityError) return securityError;
    }
  }

  // 2. Deep Heuristic Scan of all string values (Catch-all for non-standard keys)
  const scanRecursive = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Heuristic: string looks like a path or contains a slash
        // and it targets a known protected directory prefix
        const isPathLike = value.includes('/') || value.includes('\\') || value.includes('.');
        if (isPathLike && isProtectedPath(value)) {
          const securityError = checkFileSecurity(
            value,
            args.manuallyApproved as boolean | undefined,
            `${operationName} [discovered path in arg: ${key}]`
          );
          if (securityError) return securityError;
        }
      } else if (typeof value === 'object') {
        const error = scanRecursive(value);
        if (error) return error;
      }
    }
    return null;
  };

  return scanRecursive(args);
}

/**
 * Validates a file path against protection rules.
 *
 * @param filePath - The path to the file to check.
 * @param manuallyApproved - Whether the user has explicitly approved this operation.
 * @param operation - The type of operation (e.g., 'writes', 'deletes').
 * @returns An error message string if blocked, otherwise null.
 */
export function checkFileSecurity(
  filePath: string,
  manuallyApproved: boolean = false,
  operation: string = 'writes'
): string | null {
  if (isProtectedPath(filePath) && !manuallyApproved) {
    return `PERMISSION_DENIED: Direct ${operation} to '${filePath}' is blocked. This is a protected system file. To override, you must obtain explicit human approval and then retry with the 'manuallyApproved: true' parameter.`;
  }
  return null;
}
