export function log(prefix: string, msg: string) {
  console.log(`\x1b[35m[${prefix}]\x1b[0m ${msg}`);
}

export function warn(prefix: string, msg: string) {
  console.log(`\x1b[33m[${prefix} WARNING]\x1b[0m ${msg}`);
}

export function err(prefix: string, msg: string): never {
  console.error(`\x1b[31m[${prefix} ERROR]\x1b[0m ${msg}`);
  process.exit(1);
}
