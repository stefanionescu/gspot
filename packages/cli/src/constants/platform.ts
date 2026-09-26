// The literal values platform reads: names, patterns, limits, and tables.

/** Read by everyone and written by nobody: the mode of a generated file. */
export const READ_ONLY_FILE = 0o444;
/** Read by everyone and written by the owner: the mode of an ordinary file. */
export const OWNER_WRITABLE_FILE = 0o644;
/** Read and run by everyone, written by the owner: the mode of a program. */
export const EXECUTABLE_FILE = 0o755;
/** Read and written by the owner alone: the mode of a private file. */
export const PRIVATE_FILE = 0o600;
/** Entered, read, and written by the owner alone: the mode of a private directory. */
export const PRIVATE_DIRECTORY = 0o700;
/** Read and written by everyone: the mode Windows reports for a writable file. */
export const WRITABLE_FILE = 0o666;
/** The permission bits of a mode, without the file type. */
export const PERMISSION_BITS = 0o777;
/** The permission bits together with the setuid, setgid, and sticky bits. */
export const MODE_BITS = 0o7777;
/** The execute bits of the owner, the group, and others. */
export const EXECUTE_BITS = 0o111;
/** The owner's write bit. */
export const OWNER_WRITE_BIT = 0o200;
export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;
export const TRAILING_DOT_OR_SPACE = /[. ]$/u;
/** Recovery and ownership metadata never enter repository checks or generated proposals. */
export const LIFECYCLE_PRIVATE_PATH =
    /(?:^|\/)\.gspot\/(?:state(?:\/|$)|ownership\.json$|writer\.lock$|recovery(?:\/|$))/iu;
export const MISSING_CODE = 127;
export const FAILED_CODE = 1;
// taskkill exits 128 when the process tree is already gone.
export const TASKKILL_GONE_CODE = 128;
// How long a terminated tool may keep its output pipes open.
export const DRAIN_MS = 5000;
// Bun emits exit before Darwin finishes reaping the group leader; descendants holding pipes are signaled after this.
export const REAP_MS = 10;
export const GRAMMAR_SOURCES: Record<string, string> = {
    'bash.wasm': 'tree-sitter-bash/tree-sitter-bash.wasm',
    'css.wasm': 'tree-sitter-css/tree-sitter-css.wasm',
    'html.wasm': 'tree-sitter-html/tree-sitter-html.wasm',
    'javascript.wasm': 'tree-sitter-javascript/tree-sitter-javascript.wasm',
    'python.wasm': 'tree-sitter-python/tree-sitter-python.wasm',
    'tsx.wasm': 'tree-sitter-typescript/tree-sitter-tsx.wasm',
    'typescript.wasm': 'tree-sitter-typescript/tree-sitter-typescript.wasm',
    'web-tree-sitter.wasm': 'web-tree-sitter/web-tree-sitter.wasm',
    'libpg-query.wasm': 'libpg-query/wasm/libpg-query.wasm',
};
export const ROOT_SEARCH_DEPTH = 6;
export const PORTABLE_LINK_TARGET = /[\\:\p{Cc}]/u;
export const DECLARATION_EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts'];
/** Repository-relative paths shared by generation, execution, and lifecycle storage. */
export const CONFIGURATION_DIRECTORY = '.gspot/config';
export const STATE_DIRECTORY = '.gspot/state';
export const OWNERSHIP_FILE = `${STATE_DIRECTORY}/ownership.json`;
export const REPORT_DIRECTORY = '.gspot/reports';
export const CACHE_DIRECTORY = '.gspot/cache';
export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';
export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';
export const PRIVATE_PATHS = [
    `${NODE_MODULES_DIRECTORY}/`,
    `${PYTHON_ENVIRONMENT_DIRECTORY}/`,
    `${STATE_DIRECTORY}/`,
    `${CACHE_DIRECTORY}/`,
    `${REPORT_DIRECTORY}/`,
];
