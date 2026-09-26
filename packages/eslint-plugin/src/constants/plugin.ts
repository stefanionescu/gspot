// The literal values plugin reads: names, patterns, limits, and tables.

export const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
export const TYPE_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);
// Alternative re-export policies are selected explicitly.
export const INDEX_ONLY_RULES = new Set(['max-barrel-reexports', 'no-reexports-outside-index']);
export const ENVIRONMENT_HOSTS = new Set(['process', 'Bun', 'Deno']);
export const INDEX_BASENAMES = new Set([
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'index.mjs',
    'index.cjs',
    'index.mts',
    'index.cts',
]);
export const STDIN_NAMES = new Set(['', '<input>', '<text>']);
export const FILE_SCHEME = 'file://';
export const DECLARATION_SUFFIX = '.d.ts';
/** The extensions of code files the rules look at. */
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];
