/** The grammar packages whose WebAssembly files gspot ships in grammars/, by file name. */
export const GRAMMAR_PACKAGES = {
    'bash.wasm': 'tree-sitter-bash/tree-sitter-bash.wasm',
    'css.wasm': 'tree-sitter-css/tree-sitter-css.wasm',
    'html.wasm': 'tree-sitter-html/tree-sitter-html.wasm',
    'javascript.wasm': 'tree-sitter-javascript/tree-sitter-javascript.wasm',
    'python.wasm': 'tree-sitter-python/tree-sitter-python.wasm',
    'tsx.wasm': 'tree-sitter-typescript/tree-sitter-tsx.wasm',
    'typescript.wasm': 'tree-sitter-typescript/tree-sitter-typescript.wasm',
} as const;

export const SWIFT_GRAMMAR_FILE = 'swift.wasm';
export const SWIFT_GRAMMAR_PIN = {
    version: '0.7.3',
    url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    checksum: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
    license: {
        url: 'https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/b8b22bffbb3441780e6471665bacfb263741c86a/LICENSE',
        checksum: '3533cec129bb4bba015c0d61d86dd7c3b7e82110e4d2ff7837a01eff5bad5ccc',
    },
} as const;

export const CHECKSUM_ALGORITHM = 'sha256';
export const LICENSES_FOLDER = 'licenses';
export const PACKAGE_LICENSE_FILE = 'LICENSE';
export const SWIFT_LICENSE_FILE = 'tree-sitter-swift.txt';
