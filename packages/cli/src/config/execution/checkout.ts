// The literal values execution/checkout reads: names, patterns, limits, and tables.
import { EXECUTABLE_FILE, PERMISSION_BITS, OWNER_WRITABLE_FILE } from '#cli/config/platform/platform.ts';

// The literal values repository/revisions reads: names, patterns, limits, and tables.

export const WRITE_BATCH = 64;
export const NEWLINE = 10;
export const ENTRY_MODES: Record<string, number> = {
    '100644': OWNER_WRITABLE_FILE,
    '100755': EXECUTABLE_FILE,
    '120000': PERMISSION_BITS,
};
export const COPY_CONCURRENCY = 8;
export const LOCKS = ['package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'Package.resolved'];
export const VALE_INI = '.gspot/config/vale.ini';

/** Entered, read, and written by the owner alone: the mode of a private directory. */
export const PRIVATE_DIRECTORY = 0o700;
