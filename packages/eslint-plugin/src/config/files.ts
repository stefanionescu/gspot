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

export const STDIN_NAMES = new Set(['', '<input>', '<text>']);

export const FILE_SCHEME = 'file://';

export const INTERNAL_PREFIXES = ['./', '../', '@/', '#'];
