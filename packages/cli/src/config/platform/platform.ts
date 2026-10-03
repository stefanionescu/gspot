// The literal values platform reads: names, patterns, limits, and tables.

/** Where the arguments of the command begin: after the runtime and the script. */
export const ARGUMENT_START = 2;

export const GIT_TIMEOUT_MS = 30_000;

/** Read by everyone and written by nobody: the mode of a generated file. */
export const READ_ONLY_FILE = 0o444;

/** Read and written by everyone: the mode Windows reports for a writable file. */
export const WRITABLE_FILE = 0o666;

/** The owner's write bit. */
export const OWNER_WRITE_BIT = 0o200;
export const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
export const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;
export const UNSAFE_PATH_END = /[. ]$/u;

/** The lifecycle state folder never enters repository checks or generated plans. */
export const LIFECYCLE_PRIVATE_PATH = /(?:^|\/)\.gspot\/state(?:\/|$)/iu;
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

export const DECLARATION_EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts'];

export const SUGGESTION_LIMIT = 3;
export const TYPO_MIN = 2;
export const TYPO_FRACTION = 3;

/** How many names a message lists before it counts the rest. */
export const LIST_LIMIT = 8;

/** The exit of a command that found something to fix: a finding, a broken tool for doctor. */
export const EXIT_FINDINGS = 1;

/** The exit of a command that did not finish: an error, a refusal, an unreadable input, or a cancellation. */
export const EXIT_ERROR = 2;

/** Milliseconds in a second, for durations shown in seconds. */
export const MS_PER_SECOND = 1000;

/** Bytes in a kilobyte, for sizes shown in kilobytes. */
export const BYTES_PER_KB = 1024;

/** A whole share, for ratios shown as percentages. */
export const FULL_PERCENTAGE = 100;

/** Two items read together: a key and its value, an opening and closing quote, or two characters. */
export const PAIR = 2;

/** Read by everyone and written by the owner: the mode of an ordinary file. */
export const OWNER_WRITABLE_FILE = 0o644;

/** Read and run by everyone, written by the owner: the mode of a program. */
export const EXECUTABLE_FILE = 0o755;

/** The permission bits of a mode, without the file type: also the mode Git records for a link. */
export const PERMISSION_BITS = 0o777;
