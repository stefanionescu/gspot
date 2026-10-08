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

/** The WebAssembly files that runtime dependencies bring, by file name. */
export const RUNTIME_WASM: Record<string, string> = {
    'web-tree-sitter.wasm': 'web-tree-sitter/web-tree-sitter.wasm',
    'libpg-query.wasm': 'libpg-query/wasm/libpg-query.wasm',
};

/** The prepared Swift WebAssembly file shipped beside the runtime grammars. */
export const SWIFT_GRAMMAR_FILE = 'swift.wasm';

/** The pinned upstream Swift parser and its license, downloaded into grammars/ and verified by checksum. */
export const SWIFT_GRAMMAR = {
    name: SWIFT_GRAMMAR_FILE,
    version: '0.7.3',
    url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    checksum: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
    license: {
        url: 'https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/b8b22bffbb3441780e6471665bacfb263741c86a/LICENSE',
        checksum: '3533cec129bb4bba015c0d61d86dd7c3b7e82110e4d2ff7837a01eff5bad5ccc',
    },
} as const;

export const DOWNLOAD_TIMEOUT_MS = 30_000;
