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

export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

export const SETUP_ARGUMENTS = [
    '',
    'two words',
    "a'b",
    '$(touch unexpected)',
    'x; touch unexpected',
    'line\nbreak',
] as const;

export const LINUX_PIPELINE = {
    version: '1.2.3',
    packageManager: { name: 'npm' as const, version: '11.10.1' },
    operatingSystems: ['linux' as const],
    linuxRunner: 'ubuntu-24.04' as const,
    lockfiles: ['package-lock.json', 'web/pnpm-lock.yaml'],
    projectInstall: [],
    packageManagers: ['npm' as const, 'pnpm' as const],
    testChecks: [],
};

export const START_COMMANDS = [
    ['npm', 'npm@11.10.1', ['exec', '--no', '--', 'gspot']],
    ['pnpm', 'pnpm@10.32.1', ['exec', 'gspot']],
    ['yarn', 'yarn@4.13.0', ['exec', '--', 'gspot']],
    ['bunx', 'bun@1.4.2', ['--no-install', 'gspot']],
    ['mise', undefined, ['exec', '--', 'gspot']],
] as const;

export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;
