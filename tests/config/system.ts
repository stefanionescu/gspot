// assets
export const BASH_MANIFEST = '[configuration]\nname = "bash"\n';

// folders
export const LINKED_GLOBS = [
    { link: '.config', target: '../outside', pattern: '.config/sub/*.toml' },
    { link: '.config/sub', target: '../../outside/sub', pattern: '.config/sub/*.toml' },
    { link: '.config', target: '../outside', pattern: '.config/sub/tool.toml' },
];
export const OUTSIDE_PATTERNS = [
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
] as const;

// stopped children
export const STOPPED_CAPTURES = [
    ['text', 'timeout'],
    ['bytes', 'canceled'],
] as const;
export const STREAM_FAILURE = 'Test stream failure.';
