/**
 * Validates that an object has all required fields populated.
 *
 * @param obj - The object to validate.
 * @param required - Array of keys that must be present and non-empty.
 * @param context - Context name for error messages.
 * @throws Error if missing required fields.
 */
export function validateRequiredFields<T extends object>(
  obj: T | undefined,
  required: (keyof T)[],
  context: string
): void {
  if (!obj) {
    throw new Error(`${context} is required but received undefined or null.`);
  }

  const missing = required.filter(
    (key) => obj[key] === undefined || obj[key] === null || obj[key] === ''
  );

  if (missing.length > 0) {
    throw new Error(`${context} missing required fields: ${missing.join(', ')}.`);
  }
}
