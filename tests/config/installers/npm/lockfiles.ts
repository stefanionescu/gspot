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
