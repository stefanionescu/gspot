export const ALIAS_FILES = [
    {
        path: 'package.json',
        message: 'package.json:1:38 is not valid JSON: PropertyNameExpected. Fix the file.',
    },
    {
        path: 'tsconfig.json',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;

export const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;

export const SCOPE_ALIASES = {
    '#app/*': 'src/*',
    '#root/*': 'root/*',
    '@root/*': 'typed/*',
    '#shared/*': 'compiler/*',
} as const;

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

export const UNSUPPORTED_PACKAGE_MANAGERS = [
    { field: 'packageManager', written: 'cnpm@9.0.0', packageJson: { packageManager: 'cnpm@9.0.0' } },
    { field: 'packageManager', written: 'pnpm@9.0.0@x', packageJson: { packageManager: 'pnpm@9.0.0@x' } },
    {
        field: 'devEngines.packageManager',
        written: '9.0.0',
        packageJson: { devEngines: { packageManager: { name: 'cnpm', version: '9.0.0' } } },
    },
] as const;

export const INACTIVE_LERNA_FILES = {
    'package.json': '{}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
    'lerna.json': 'malformed inactive configuration',
    'packages/app/package.json': '{"name":"inside"}',
} as const;

export const NESTED_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]',
    'packages/parent/package.json': '{"name":"parent"}',
    'child/package.json': '{}',
    'empty/source.py': '',
} as const;

export const OUTSIDE_WORKSPACE_FILES = [
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
] as const;
