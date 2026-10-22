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
