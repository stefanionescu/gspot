export const PRETTIER_IGNORE_SETTINGS = {
    configurations: ['format', 'javascript'],
    ignore: [
        {
            check: 'format/prettier',
            paths: ['authored/omitted.ts'],
            reason: 'This output retains its authored layout.',
        },
    ],
} as const;

export const PRETTIER_IGNORE_CASES = [
    { file: 'src/dist/source.ts', ignored: true },
    { file: 'generated/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'pnpm-lock.yaml', ignored: true },
] as const;

export const LANGUAGE_IGNORES = [
    {
        name: 'Python without JavaScript',
        configurations: ['format', 'markdown', 'python'],
        scopes: [],
        ignored: [{ path: '.venv/', pattern: '**/.venv/**' }],
        absent: ['.build/', 'Package.resolved'],
    },
    {
        name: 'Swift without JavaScript',
        configurations: ['format', 'markdown', 'swift'],
        scopes: [],
        ignored: [
            { path: '.build/', pattern: '.build/' },
            { path: 'DerivedData/', pattern: 'DerivedData/' },
            { path: 'Pods/', pattern: '**/Pods/**' },
        ],
        absent: ['**/node_modules/**', 'package-lock.json', '**/.venv/**', 'uv.lock'],
    },
    {
        name: 'JavaScript',
        configurations: ['format', 'markdown', 'javascript'],
        scopes: [],
        ignored: [{ path: 'node_modules/', pattern: '**/node_modules/**' }],
        absent: ['.build/', 'Package.resolved', '**/.venv/**', 'uv.lock'],
    },
    {
        name: 'a JavaScript child of Python',
        configurations: ['format', 'markdown', 'python'],
        scopes: [{ path: 'web', configurations: ['javascript'] }],
        ignored: [
            { path: '.venv/', pattern: '**/.venv/**' },
            { path: 'node_modules/', pattern: '**/node_modules/**' },
        ],
        absent: ['.build/', 'Package.resolved'],
    },
] as const;

export const PATH_IGNORE_CASES = [
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        file: 'typos.toml',
        nativePath: ['files', 'extend-exclude'],
    },
    {
        configuration: 'duplication',
        check: 'duplication/jscpd',
        file: 'jscpd.json',
        nativePath: ['ignore'],
    },
    {
        configuration: 'javascript',
        check: 'javascript/knip',
        file: 'knip.json',
        nativePath: ['ignore'],
    },
] as const;

export const IGNORE_LIST_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'apps/web', configurations: ['javascript', 'css'] },
        { path: 'services/api', configurations: ['python'] },
    ],
} as const;

export const IGNORE_LIST_FILES = {
    'apps/web/package.json': '{"name":"web","private":true}\n',
    'apps/web/source.js': 'export const value = 1;\n',
    'apps/web/style.css': 'a { color: red; }\n',
    'services/api/pyproject.toml': '[project]\nname = "api"\nversion = "0.1.0"\n',
    'services/api/source.py': 'VALUE = 1\n',
    'README.md': '# Example\n',
    'source.js': 'export const other = 2;\n',
} as const;
