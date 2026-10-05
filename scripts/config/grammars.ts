import { SWIFT_GRAMMAR_FILE } from '#cli/config/platform/assets.ts';

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
