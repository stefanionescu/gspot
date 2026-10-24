export const ROOT_DEPENDENCIES = [
    [
        'npm',
        '{"packages":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"node_modules/eslint":{"version":"9.39.5","integrity":"sha512-YQ=="},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}}}',
        { eslint: '9.39.5' },
    ],
    ['npm', '{"packages":{"":{"dependencies":{"runtime":"1.0.0"}}}}', {}],
    [
        'bun',
        '{"workspaces":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}},"packages":{"eslint":["eslint@9.39.5","",{},"sha512-YQ=="]}}',
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
packages:
  eslint@9.39.5:
    resolution:
      integrity: sha512-YQ==
`,
        { eslint: '9.39.5' },
    ],
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
