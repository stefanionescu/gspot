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
/** The owner's write bit. */
export const OWNER_WRITE_BIT = 0o200;
export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;
export const UNSAFE_PATH_END = /[. ]$/u;
/** Recovery and ownership metadata never enter repository checks or generated plans. */
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
/** The grammar packages whose WebAssembly files gspot ships in grammars/, by file name. */
export const GRAMMAR_PACKAGES: Record<string, string> = {
    'bash.wasm': 'tree-sitter-bash/tree-sitter-bash.wasm',
    'css.wasm': 'tree-sitter-css/tree-sitter-css.wasm',
    'html.wasm': 'tree-sitter-html/tree-sitter-html.wasm',
    'javascript.wasm': 'tree-sitter-javascript/tree-sitter-javascript.wasm',
    'python.wasm': 'tree-sitter-python/tree-sitter-python.wasm',
    'ruby.wasm': 'tree-sitter-ruby/tree-sitter-ruby.wasm',
    'tsx.wasm': 'tree-sitter-typescript/tree-sitter-tsx.wasm',
    'typescript.wasm': 'tree-sitter-typescript/tree-sitter-typescript.wasm',
};
/** Every grammar file in grammars/. */
export const GRAMMAR_FILES = [...Object.keys(GRAMMAR_PACKAGES), 'swift.wasm'];
/** The WebAssembly files that runtime dependencies bring, by file name. */
export const RUNTIME_WASM: Record<string, string> = {
    'web-tree-sitter.wasm': 'web-tree-sitter/web-tree-sitter.wasm',
    'libpg-query.wasm': 'libpg-query/wasm/libpg-query.wasm',
};
export const ROOT_SEARCH_DEPTH = 6;
export const PORTABLE_LINK_TARGET = /[\\:\p{Cc}]/u;
export const DECLARATION_EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts'];
/** Repository-relative paths shared by generation, execution, and lifecycle storage. */
export const GSPOT_FOLDER = '.gspot';
export const CONFIGURATION_DIRECTORY = '.gspot/config';
export const STATE_DIRECTORY = '.gspot/state';
export const OWNERSHIP_FILE = `${STATE_DIRECTORY}/ownership.json`;
export const REPORT_DIRECTORY = '.gspot/reports';
export const CACHE_DIRECTORY = '.gspot/cache';
export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';
export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';
/** The folder each private installation kind is written to. */
export const INSTALLATION_FOLDERS = { npm: NODE_MODULES_DIRECTORY, python: PYTHON_ENVIRONMENT_DIRECTORY } as const;
export const PRIVATE_PATHS = [
    `${NODE_MODULES_DIRECTORY}/`,
    `${PYTHON_ENVIRONMENT_DIRECTORY}/`,
    `${STATE_DIRECTORY}/`,
    `${CACHE_DIRECTORY}/`,
    `${REPORT_DIRECTORY}/`,
];

/** The pinned upstream Swift parser and its license, downloaded into grammars/ and verified by checksum. */
export const SWIFT_GRAMMAR = {
    version: '0.7.3',
    url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    checksum: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
    license: {
        url: 'https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/b8b22bffbb3441780e6471665bacfb263741c86a/LICENSE',
        checksum: '3533cec129bb4bba015c0d61d86dd7c3b7e82110e4d2ff7837a01eff5bad5ccc',
    },
} as const;
/** Where the arguments of the command begin: after the runtime and the script. */
export const ARGUMENT_START = 2;
