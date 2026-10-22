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
