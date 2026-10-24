export const INDEX_BASENAMES = new Set([
    'index',
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'index.mjs',
    'index.cjs',
    'index.mts',
    'index.cts',
]);

export const IMPORT_SELECTOR = 'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression';

export const RELATIVE_PREFIXES = ['./', '../'] as const;
