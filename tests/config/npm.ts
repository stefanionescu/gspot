/** The declared package manager version supplied by the process boundary. */
const NPM_VERSION = '11.19.0';

/** A successful command with no diagnostic output. */
const NPM_SUCCESS = { code: 0, missing: false, duration: 1, stdout: '', stderr: '' } as const;

const NEXT_INSTALLATIONS = [
    {
        name: 'an uninstalled Next uses the shipped manifest pin',
        rootVersion: undefined,
        childVersion: undefined,
        expected: '16.3.8',
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

// The authored files every package project starts from.
const NPM_SANDBOX_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
} as const;

/** The package managers, manifest paths a package project test covers. */
const NPM_CLIENT_ROWS = [
    ['npm', 'package.json'],
    ['bun', 'package.json'],
    ['pnpm', 'package.json'],
    ['yarn', 'package.json'],
    ['npm', 'apps/web/package.json'],
] as const;

/** Package-manager sandboxes exercise Prettier and native EditorConfig installation, not application analyzers. */
const NPM_SANDBOX_IGNORES = ['files/v8r', 'javascript/eslint', 'javascript/tsc', 'javascript/knip'] as const;

const NPM_REGISTRY_TOKEN = 'synthetic-package-install-token';

const YARN_CLIENTS = [
    {
        installer: { name: 'yarn', version: '1.22.22' },
        lockfile: ['yarn', 'install'],
        install: ['yarn', 'install', '--frozen-lockfile'],
        settings: false,
    },
    {
        installer: { name: 'yarn', version: '4.12.0' },
        lockfile: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
        settings: true,
    },
] as const;

/** Distinct root and child package facts belong to the same captured source inventory. */
const REACT_VUE_PACKAGES = {
    'package.json': '{"name":"root-sandbox","private":true,"dependencies":{"react":"19.0.0"}}',
    'app/package.json': '{"name":"child-sandbox","private":true,"dependencies":{"vue":"3.5.0"}}',
    'main.js': 'export const ready = true;\n',
    'app/main.js': 'export const ready = true;\n',
} as const;

const ROOT_PACKAGE_WITHOUT_DEPENDENCIES = '{"name":"root-sandbox","private":true,"dependencies":{}}';

const CLEAR_DEPENDENCIES_SCRIPT = `require('node:fs').writeFileSync('package.json', '{"name":"root-sandbox","private":true,"dependencies":{}}')`;

const NPM_CLIENT_DECLARATIONS = [
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

const DECLARED_VERSION_FILES = {
    'package.json': '{"packageManager":"bun@0.0.0"}\n',
} as const;

const INSTALL_FAILURES = [
    { frozen: false, refusal: 'HTTP 403 Forbidden' },
    { frozen: true, refusal: 'HTTP 403 Forbidden' },
] as const;

const VERSION_SOURCES = [
    { source: 'authored', operation: 'lockfile', files: DECLARED_VERSION_FILES } as const,
    { source: 'authored', operation: 'install', files: DECLARED_VERSION_FILES } as const,
] as const;

const NPM_SANDBOX_PACKAGE = {
    private: true,
    devDependencies: { eslint: '0.0.0-authored' },
    scripts: { test: 'authored-command' },
    workspaces: ['**'],
} as const;

const PNPM_WORKSPACE = 'packages:\n  - "**"\n';

export {
    NPM_VERSION,
    NPM_SUCCESS,
    YARN_CLIENTS,
    PNPM_WORKSPACE,
    NPM_CLIENT_ROWS,
    VERSION_SOURCES,
    INSTALL_FAILURES,
    TOOL_REQUIREMENTS,
    ROOT_DEPENDENCIES,
    NPM_SANDBOX_FILES,
    NEXT_INSTALLATIONS,
    NPM_REGISTRY_TOKEN,
    REACT_VUE_PACKAGES,
    NPM_SANDBOX_IGNORES,
    NPM_SANDBOX_PACKAGE,
    NPM_CLIENT_DECLARATIONS,
    NON_EXACT_PNPM_VERSIONS,
    CLEAR_DEPENDENCIES_SCRIPT,
    ROOT_PACKAGE_WITHOUT_DEPENDENCIES,
};

export const YARN_VERSION_THRESHOLD = 2;
