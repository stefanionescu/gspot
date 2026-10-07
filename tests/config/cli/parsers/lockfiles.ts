/** Root development requirements exclude production and workspace dependencies. */
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
        'importers:\n  .:\n    devDependencies:\n      eslint:\n        specifier: 9.39.5\n        version: 9.39.5\n    dependencies:\n      runtime:\n        specifier: 1.0.0\n  apps/api:\n    devDependencies:\n      typescript:\n        specifier: 5.9.3\n',
        { eslint: '9.39.5' },
    ],
] as const;
