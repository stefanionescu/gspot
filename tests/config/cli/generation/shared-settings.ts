export const KNIP = '.gspot/config/knip.json';
export const STYLELINT = '.gspot/config/stylelint.json';
export const RUFF = '.gspot/config/ruff.toml';

export const TAILWIND_PROJECT_FILES = {
    'package.json': '{"private":true,"devDependencies":{"tailwindcss":"4.1.13"}}\n',
};

/** Check-specific file ignores reach the native discovery owners that read them. */
export const PATH_IGNORE_CONFIGURATIONS = [
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: '.gspot/config/typos.toml',
        nativePath: ['files', 'extend-exclude'],
    },
    {
        configuration: 'duplication',
        check: 'duplication/jscpd',
        path: '.gspot/config/jscpd.json',
        nativePath: ['ignore'],
    },
    { configuration: 'javascript', check: 'javascript/knip', path: KNIP, nativePath: ['ignore'] },
];

/** Native repository manager inputs used for the resolved site build default. */
export const SITE_PACKAGE_INSTALLERS = [
    ['npm fallback', {}, 'npm'],
    ['declared Bun', { 'package.json': '{"packageManager":"bun@1.4.2"}' }, 'bun'],
    ['declared Yarn', { 'package.json': '{"packageManager":"yarn@1.22.22"}' }, 'yarn'],
    ['declared pnpm', { 'package.json': '{"packageManager":"pnpm@9.1.0"}' }, 'pnpm'],
    [
        'Bun lockfile',
        { 'package.json': '{}', 'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}' },
        'bun',
    ],
    ['Yarn lockfile', { 'package.json': '{}', 'yarn.lock': '# yarn lockfile v1\n' }, 'yarn'],
    ['pnpm lockfile', { 'package.json': '{}', 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" }, 'pnpm'],
] as const;

export const SITE_BUILD_COMMANDS = [[], ['custom-builder', '', 'two words'], ['npm', 'run', 'build']];
