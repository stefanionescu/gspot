export const OUTSIDE_PATTERNS = [
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
] as const;

export const LINKED_GLOBS = [
    { link: '.config', target: '../outside', pattern: '.config/sub/*.toml' },
    { link: '.config/sub', target: '../../outside/sub', pattern: '.config/sub/*.toml' },
    { link: '.config', target: '../outside', pattern: '.config/sub/tool.toml' },
];

export const STREAM_FAILURE = 'Test stream failure.';

export const STOPPED_CAPTURES = [
    ['text', 'timeout'],
    ['bytes', 'canceled'],
] as const;

export const BASH_MANIFEST = '[configuration]\nname = "bash"\n';
