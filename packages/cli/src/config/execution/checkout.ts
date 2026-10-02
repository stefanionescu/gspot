// The literal values execution/checkout reads: names, patterns, limits, and tables.

const LINK_MODE = 0o777;

// The literal values repository/revisions reads: names, patterns, limits, and tables.

export const MATERIALIZATION_BATCH_SIZE = 64;
export const NEWLINE = 10;
export const EXECUTABLE_MODE = 0o755;
export const FILE_MODE = 0o644;
export const ENTRY_MODES: Record<string, number> = {
    '100644': FILE_MODE,
    '100755': EXECUTABLE_MODE,
    '120000': LINK_MODE,
};
export const COPY_CONCURRENCY = 8;
export const LOCKS = ['package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'Package.resolved'];
export const VALE_CONFIGURATION = '.gspot/config/vale.ini';

/** Entered, read, and written by the owner alone: the mode of a private directory. */
export const PRIVATE_DIRECTORY = 0o700;
