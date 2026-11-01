import { NPM_TOOL_PROJECT } from '#cli/config/generation.ts';

export const REGISTRY_PASSWORDS = [
    ['https://alex@example.com/simple', []],
    ['https://alex:test%2Bpassword@example.com/simple', ['test%2Bpassword', 'test+password']],
    ['https://alex:password@example.com/simple', ['password', 'password']],
] as const;

export const LEAKED_LOCKFILES = [
    'password = "synthetic/password+with spaces"',
    'url = "https://alex:synthetic%2Fpassword%2Bwith%20spaces@example.com/simple"',
] as const;

export const ROOT_DEPENDENCIES = [
    {
        name: 'npm with root development dependencies',
        manager: 'npm',
        source: '{"packages":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"node_modules/eslint":{"version":"9.39.5","integrity":"sha512-YQ=="},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}}}',
        expected: { eslint: '9.39.5' },
    },
    {
        name: 'npm without development dependencies',
        manager: 'npm',
        source: '{"packages":{"":{"dependencies":{"runtime":"1.0.0"}}}}',
        expected: {},
    },
    {
        name: 'bun with root development dependencies',
        manager: 'bun',
        source: '{"workspaces":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}},"packages":{"eslint":["eslint@9.39.5","",{},"sha512-YQ=="]}}',
        expected: { eslint: '9.39.5' },
    },
    { name: 'bun without development dependencies', manager: 'bun', source: '{"workspaces":{}}', expected: {} },
    {
        name: 'pnpm with root development dependencies',
        manager: 'pnpm',
        source: `importers:
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
packages:
  eslint@9.39.5:
    resolution:
      integrity: sha512-YQ==
`,
        expected: { eslint: '9.39.5' },
    },
] as const;

export const LOCKFILE_REGISTRY = { npm_config_registry: 'https://registry.npmjs.org/' };

export const LOCKFILE_SECURITY_CASES = [
    ['portable package', 'is-number', '7.0.0', '', true],
    ['identity swap', 'left-pad', '1.3.0', '', false],
    ['root downgrade', 'is-number', '6.0.0', '', false],
    ['foreign tarball', 'is-number', '7.0.0', 'https://attacker.example/evil.tgz', false],
    ['registry tarball swap', 'is-number', '7.0.0', 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz', false],
    ['standard tarball', 'is-number', '7.0.0', 'https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz', true],
] as const;

export const LOCKFILE_REGISTRY_CASES = [
    [
        'public tarball outside the private default registry',
        'is-number',
        '7.0.0',
        'https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz',
        false,
        { npm_config_registry: 'https://packages.example/' },
        'is-number',
    ],
    [
        'exact private default registry tarball',
        'is-number',
        '7.0.0',
        'https://packages.example/is-number/-/is-number-7.0.0.tgz',
        true,
        { npm_config_registry: 'https://packages.example/' },
        'is-number',
    ],
    [
        'public tarball explicitly selected for a scope',
        '@example/package',
        '7.0.0',
        'https://registry.npmjs.org/@example/package/-/package-7.0.0.tgz',
        true,
        {
            npm_config_registry: 'https://packages.example/',
            'npm_config_@example:registry': 'https://registry.npmjs.org/',
        },
        '@example/package',
    ],
    [
        'public tarball outside a private scope registry',
        '@example/package',
        '7.0.0',
        'https://registry.npmjs.org/@example/package/-/package-7.0.0.tgz',
        false,
        {
            npm_config_registry: 'https://registry.npmjs.org/',
            'npm_config_@example:registry': 'https://packages.example/',
        },
        '@example/package',
    ],
    [
        'exact private scope registry tarball',
        '@example/package',
        '7.0.0',
        'https://packages.example/@example/package/-/package-7.0.0.tgz',
        true,
        {
            npm_config_registry: 'https://registry.npmjs.org/',
            'npm_config_@example:registry': 'https://packages.example/',
        },
        '@example/package',
    ],
] as const;

export const NPMRC_REFUSALS = [
    {
        name: 'a registry password with a broken percent escape',
        source: 'registry=https://u:pa%zz@host/\n',
        message: 'A registry URL in the .npmrc files is not valid.',
    },
    {
        name: 'a number setting with text',
        source: 'maxsockets=not-a-number\n',
        message: 'The .npmrc settings are not valid.',
    },
] as const;

export const LINKED_NODE_FILES = {
    'actual/bin/node': '',
    'actual/etc/npmrc': 'registry=https://actual.example/\n',
    'linked/bin/.keep': '',
    'linked/etc/npmrc': 'registry=https://wrong.example/\n',
    'project/package.json': '{"private":true}',
};

export const NPM_PREFIX_ENVIRONMENT = {
    PREFIX: undefined,
    npm_config_prefix: undefined,
    NPM_CONFIG_PREFIX: undefined,
    npm_config_globalconfig: undefined,
    NPM_CONFIG_GLOBALCONFIG: undefined,
    NPM_CONFIG_USERCONFIG: undefined,
    npm_config_registry: undefined,
    NPM_CONFIG_REGISTRY: undefined,
};

export const FAILED_INSTALL_CASES = [
    { operation: 'installation', frozen: true },
    { operation: 'lockfile resolution', frozen: false },
] as const;

export const PACKAGE_MANAGER_AGE_CASES = [
    { name: 'npm', version: '11.18.0', minimum: '11.19.0', accepted: false },
    { name: 'npm', version: '11.19.0', minimum: '11.19.0', accepted: true },
    { name: 'pnpm', version: '10.15.0', minimum: '10.16.0', accepted: false },
    { name: 'pnpm', version: '10.16.0', minimum: '10.16.0', accepted: true },
    { name: 'bun', version: '1.2.22', minimum: '1.3.0', accepted: false },
    { name: 'bun', version: '1.3.0', minimum: '1.3.0', accepted: true },
];

export const CREDENTIAL_TOKEN = 'synthetic-generated-lockfile-token';

export const CREDENTIAL_PACKAGE_JSON = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });

export const CREDENTIAL_LOCKFILE = JSON.stringify({
    workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
    packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${CREDENTIAL_TOKEN}`, {}, 'integrity'] },
});
