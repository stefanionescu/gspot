import { ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/data/repository/dependency-files.ts';

export const NEXT_INSTALLATIONS = [
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

export const TOOL_REQUIREMENTS = [
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

/** Only the root development dependencies count. Production and workspace dependencies do not. */
export const ROOT_DEPENDENCIES = [
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

/** The package managers and dependency files that a package project test covers. */
export const PACKAGE_MANAGER_ROWS = [
    ['npm', 'package.json'],
    ['bun', 'package.json'],
    ['pnpm', 'package.json'],
    ['yarn', 'package.json'],
    ['npm', 'apps/web/package.json'],
] as const;

export const YARN_CLIENTS = [
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

export const CLEAR_DEPENDENCIES_SCRIPT = `require('node:fs').writeFileSync('package.json', ${JSON.stringify(ROOT_PACKAGE_WITHOUT_DEPENDENCIES)})`;

export const PACKAGE_MANAGER_PIN_CASES = [
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

export const NON_EXACT_PNPM_VERSIONS = [
    [
        '{"devEngines":{"packageManager":{"name":"pnpm","version":"^9.1.0"}}}',
        'The tool project needs an exact pnpm version, such as pnpm@1.2.3; package.json declares "^9.1.0" in devEngines.packageManager. Write an exact version there.',
    ],
    [
        '{"packageManager":"pnpm@^9.1.0"}',
        'The tool project needs an exact pnpm version, such as pnpm@1.2.3; package.json declares "pnpm@^9.1.0" in packageManager. Write an exact version there.',
    ],
    [
        '{"packageManager":"pnpm"}',
        'The tool project needs an exact pnpm version, such as pnpm@1.2.3; package.json declares "pnpm" in packageManager. Write an exact version there.',
    ],
] as const;

export const OUTDATED_BUN_PACKAGE_JSON = '{"packageManager":"bun@0.0.0"}\n';
