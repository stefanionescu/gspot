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
    { file: 'vendored/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'pnpm-lock.yaml', ignored: true },
] as const;

export const LANGUAGE_IGNORES = [
    {
        name: 'Swift without JavaScript',
        configurations: ['format', 'markdown', 'swift'],
        scopes: [],
        ignored: ['.build/', 'DerivedData/', 'Pods/'],
        kept: ['node_modules/', 'package-lock.json', '.venv/', 'uv.lock'],
    },
    {
        name: 'a JavaScript child of Python',
        configurations: ['format', 'markdown', 'python'],
        scopes: [{ path: 'web', configurations: ['javascript'] }],
        ignored: ['.venv/', 'node_modules/'],
        kept: ['.build/', 'Package.resolved'],
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
        configuration: 'structure',
        check: 'structure/jscpd',
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

export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

/**
The body of a fake mise that runs the command after `--` of `mise exec`. mise exec loads the variables of the mise
config files, so the fake sets one for the command it runs.
*/
export const MISE_EXEC =
    '[ "$1" = exec ] || exit 0\nwhile [ "$1" != -- ]; do shift; done\nshift\nMISE_LOADED=1 exec "$@"\n';

export const LINUX_PIPELINE = {
    version: '1.2.3',
    node: 'node@22.0.0',
    packageManager: { name: 'npm' as const, version: '11.10.1' },
    operatingSystems: ['linux' as const],
    linuxRunner: 'ubuntu-24.04' as const,
    projectInstall: [],
    testChecks: [],
};

const BIN_FOLDER_START = { program: 'node', launcher: 'node_modules/.bin/gspot', prefix: [] } as const;

export const START_COMMANDS = [
    { manager: 'npm', packageManager: 'npm@11.10.1', ...BIN_FOLDER_START },
    {
        manager: 'yarn',
        packageManager: 'yarn@4.13.0',
        program: 'yarn',
        launcher: 'bin/yarn',
        prefix: ['exec', '--', 'gspot'],
    },
    {
        manager: 'mise',
        packageManager: undefined,
        program: 'mise',
        launcher: 'bin/mise',
        prefix: ['exec', '--', 'gspot'],
    },
] as const;

export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;
