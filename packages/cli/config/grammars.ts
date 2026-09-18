// The tree-sitter grammars the binary embeds, by the file name under grammars/ and the package file it comes from.

/** Grammar file name to the path inside its npm package. The Swift grammar is vendored by hand. */
export const GRAMMAR_SOURCES: Record<string, string> = {
    'bash.wasm': 'tree-sitter-bash/tree-sitter-bash.wasm',
    'css.wasm': 'tree-sitter-css/tree-sitter-css.wasm',
    'html.wasm': 'tree-sitter-html/tree-sitter-html.wasm',
    'javascript.wasm': 'tree-sitter-javascript/tree-sitter-javascript.wasm',
    'python.wasm': 'tree-sitter-python/tree-sitter-python.wasm',
    'tsx.wasm': 'tree-sitter-typescript/tree-sitter-tsx.wasm',
    'typescript.wasm': 'tree-sitter-typescript/tree-sitter-typescript.wasm',
    'web-tree-sitter.wasm': 'web-tree-sitter/web-tree-sitter.wasm',
};
