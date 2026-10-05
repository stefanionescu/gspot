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

export const CODE_EXTENSION = /\.[cm]?[jt]sx?$/u;

export const INTERNAL_PREFIXES = ['./', '../', '@/', '#'];

export const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
