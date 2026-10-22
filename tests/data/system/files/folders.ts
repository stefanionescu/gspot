export const OUTSIDE_PATTERNS = [
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
] as const;

export const LINKED_CONFIG_FOLDERS = [
    { link: '.config', target: '../outside', pattern: '.config/sub/*.toml' },
    { link: '.config/sub', target: '../../outside/sub', pattern: '.config/sub/*.toml' },
    { link: '.config', target: '../outside', pattern: '.config/sub/tool.toml' },
] as const;

/** Files for the glob include and exclude tests. */
export const GLOB_FILES = {
    'src/a.ts': '',
    'src/.leaf.ts': '',
    'src/Case.TS': '',
    'src/nested/.inner/b.ts': '',
    '.hidden/nested/c.ts': '',
    'node_modules/.hidden/foreign.ts': '',
} as const;

/** Source and external settings for linked mise folder checks. */
export const LINKED_CONFIG_FILES = {
    'project/source.ts': 'export {};\n',
    'outside/sub/tool.toml': 'setting = "external"\n',
} as const;
