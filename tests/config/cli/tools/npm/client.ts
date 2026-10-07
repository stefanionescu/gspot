const AUTHORED_VERSION_INPUTS: Record<string, string> = {
    'package.json': '{"packageManager":"bun@0.0.0"}\n',
};

const RECORDED_VERSION_INPUTS: Record<string, string> = {
    'bun.lock': 'recorded root lockfile\n',
    '.gspot/package.json': '{"packageManager":"bun@0.0.0"}\n',
};

export const PACKAGE_SELECTIONS = [
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
        'a lockfile with the version the tool project recorded',
        { 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n", '.gspot/package.json': '{"packageManager":"pnpm@9.4.0"}' },
        'pnpm@9.4.0',
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

export const NON_EXACT_MANAGERS = [
    '{"devEngines":{"packageManager":{"name":"pnpm","version":"^9.1.0"}}}',
    '{"packageManager":"pnpm@^9.1.0"}',
    '{"packageManager":"pnpm"}',
];

export const PACKAGE_VERSION_CASES = [
    { source: 'authored', operation: 'lockfile', files: AUTHORED_VERSION_INPUTS } as const,
    { source: 'authored', operation: 'install', files: AUTHORED_VERSION_INPUTS } as const,
    { source: 'recorded', operation: 'lockfile', files: RECORDED_VERSION_INPUTS } as const,
    { source: 'recorded', operation: 'install', files: RECORDED_VERSION_INPUTS } as const,
];
