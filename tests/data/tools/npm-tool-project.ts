const NEXT_INSTALLATIONS = [
    {
        name: 'an uninstalled Next uses the shipped manifest pin',
        rootVersion: undefined,
        childVersion: undefined,
        expected: undefined,
    },
    {
        name: 'a hoisted installed Next supplies its major to root and child',
        rootVersion: '15.5.9',
        childVersion: undefined,
        expected: '^15',
    },
    {
        name: 'different installed versions within one major share that major',
        rootVersion: '16.3.6',
        childVersion: '16.3.5',
        expected: '^16',
    },
    {
        name: 'different selected installed majors refuse one shared plugin pin',
        rootVersion: '16.3.6',
        childVersion: '15.5.9',
        expected: 'conflict',
    },
] as const;

const TOOL_REQUIREMENTS = [
    {
        name: 'a Next major requirement is accepted',
        dependency: '@next/eslint-plugin-next',
        version: '^15',
        accepted: true,
    },
    {
        name: 'an exact Next manifest pin is accepted',
        dependency: '@next/eslint-plugin-next',
        version: '16.3.6',
        accepted: true,
    },
    {
        name: 'a Next minor range is refused',
        dependency: '@next/eslint-plugin-next',
        version: '^16.3.6',
        accepted: false,
    },
    { name: 'a non-Next range is refused', dependency: 'eslint', version: '^9', accepted: false },
    { name: 'a non-Next exact pin is accepted', dependency: 'eslint', version: '9.39.5', accepted: true },
] as const;

/** Root development requirements exclude production and workspace dependencies. */
const ROOT_DEPENDENCIES = [
    [
        'npm',
        '{"packages":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}}}',
        { eslint: '9.39.5' },
    ],
    ['npm', '{"packages":{"":{"dependencies":{"runtime":"1.0.0"}}}}', {}],
    [
        'bun',
        '{"workspaces":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}}}',
        { eslint: '9.39.5' },
    ],
    ['bun', '{"workspaces":{}}', {}],
    [
        'pnpm',
        `importers:
  .:
    devDependencies:
      eslint:
        specifier: 9.39.5
        version: 9.39.5
    dependencies:
      runtime:
        specifier: 1.0.0
  apps/api:
    devDependencies:
      typescript:
        specifier: 5.9.3
`,
        { eslint: '9.39.5' },
    ],
] as const;

/** The package managers, manifest paths a package project test covers. */
const PACKAGE_MANAGER_ROWS = [
    ['npm', 'package.json'],
    ['bun', 'package.json'],
    ['pnpm', 'package.json'],
    ['yarn', 'package.json'],
    ['npm', 'apps/web/package.json'],
] as const;

const YARN_CLIENTS = [
    {
        packageManager: { name: 'yarn', version: '1.22.22' },
        lockfile: ['yarn', 'install'],
        install: ['yarn', 'install', '--frozen-lockfile'],
        settings: false,
    },
    {
        packageManager: { name: 'yarn', version: '4.12.0' },
        lockfile: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
        settings: true,
    },
] as const;

const CLEAR_DEPENDENCIES_SCRIPT = `require('node:fs').writeFileSync('package.json', '{"name":"root-sandbox","private":true,"dependencies":{}}')`;

const PACKAGE_MANAGER_DECLARATIONS = [
    [
        'a packageManager with a hash suffix',
        { 'package.json': '{"packageManager":"pnpm@9.1.0+sha512.0a1b2c"}' },
        'pnpm@9.1.0',
    ],
    [
        'an exact devEngines version',
        { 'package.json': '{"devEngines":{"packageManager":{"name":"yarn","version":"4.2.0"}}}' },
        'yarn@4.2.0',
    ],
    [
        'an explicit manager before a competing lockfile and devEngines declaration',
        {
            'package.json':
                '{"packageManager":"npm@10.9.0","devEngines":{"packageManager":{"name":"yarn","version":"4.2.0"}}}',
            'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        },
        'npm@10.9.0',
    ],
    [
        'the first devEngines manager in a list',
        {
            'package.json':
                '{"devEngines":{"packageManager":[{"name":"yarn","version":"4.2.0"},{"name":"npm","version":"10.9.0"}]}}',
        },
        'yarn@4.2.0',
    ],
] as const;

const NON_EXACT_PNPM_VERSIONS = [
    '{"devEngines":{"packageManager":{"name":"pnpm","version":"^9.1.0"}}}',
    '{"packageManager":"pnpm@^9.1.0"}',
    '{"packageManager":"pnpm"}',
] as const;

const INSTALL_FAILURES = [
    { frozen: false, refusal: 'HTTP 403 Forbidden' },
    { frozen: true, refusal: 'HTTP 403 Forbidden' },
] as const;

const AUTHORED_VERSION_CASES = [
    {
        source: 'authored',
        operation: 'install',
        files: {
            'package.json': '{"packageManager":"bun@0.0.0"}\n',
        } as const,
    } as const,
] as const;

const NPM_LAUNCHER_PROJECT = '{"private":true,"devDependencies":{"wrapper":"2.0.0"}}';
const NPM_LAUNCHER_LOCKFILE =
    '{"lockfileVersion":3,"packages":{"":{"devDependencies":{"wrapper":"2.0.0"}},"node_modules/wrapper":{"version":"2.0.0"}}}';

export {
    YARN_CLIENTS,
    INSTALL_FAILURES,
    ROOT_DEPENDENCIES,
    TOOL_REQUIREMENTS,
    NEXT_INSTALLATIONS,
    NPM_LAUNCHER_PROJECT,
    PACKAGE_MANAGER_ROWS,
    NPM_LAUNCHER_LOCKFILE,
    AUTHORED_VERSION_CASES,
    NON_EXACT_PNPM_VERSIONS,
    CLEAR_DEPENDENCIES_SCRIPT,
    PACKAGE_MANAGER_DECLARATIONS,
};
