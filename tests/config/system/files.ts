export const OUTSIDE_PATTERNS = [
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
] as const;

export const GLOB_FILES = {
    'src/a.ts': '',
    'src/.leaf.ts': '',
    'src/Case.TS': '',
    'src/nested/.inner/b.ts': '',
    '.hidden/nested/c.ts': '',
    'node_modules/.hidden/foreign.ts': '',
} as const;

export const LINKED_GLOBS = [
    { link: '.config', target: '../outside', pattern: '.config/sub/*.toml' },
    { link: '.config/sub', target: '../../outside/sub', pattern: '.config/sub/*.toml' },
    { link: '.config', target: '../outside', pattern: '.config/sub/tool.toml' },
];

export const MODE_REPLACEMENTS = [
    { original: 0o444, replacement: 0o644, content: 'replacement', posix: false },
    { original: 0o640, replacement: 0o444, content: 'replacement\n', posix: true },
] as const;
