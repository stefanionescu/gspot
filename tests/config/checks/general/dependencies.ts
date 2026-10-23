import type { CheckResult } from '#cli/types/runs/check.ts';
import { SETTING_REASON } from '#tests/config/commands/set.ts';

/** A Bun project whose lockfile disagrees with package.json, and whose react and react-dom differ. */
export const BUN_PROJECT_FILES = {
    'package.json': JSON.stringify({
        name: 'shop',
        private: true,
        dependencies: { zod: '^4.1.0', react: '19.1.0', 'react-dom': '19.0.0' },
        devDependencies: { typescript: '5.9.3' },
    }),
    'bun.lock': JSON.stringify({
        lockfileVersion: 1,
        workspaces: {
            '': {
                name: 'shop',
                dependencies: { zod: '^4.0.0', react: '19.1.0', 'react-dom': '19.0.0', 'left-pad': '1.3.0' },
            },
        },
        packages: {
            zod: ['zod@4.0.5', '', {}, 'sha512-a'],
            react: ['react@19.1.0', '', {}, 'sha512-b'],
            'react-dom': ['react-dom@19.0.0', '', {}, 'sha512-c'],
            'left-pad': ['left-pad@1.3.0', '', {}, 'sha512-d'],
        },
    }),
} as const;

/** The project that the lockfile samples change. */
export const DEPENDENCIES_SANDBOX = {
    configurations: ['dependencies'],

    files: {
        'package.json': `{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@1.4.2"\n}\n`,
    },
} as const;

/** A lockfile of each format with a download from an unknown host, and its fix. */
export const LOCKFILE_HOST_CASES = [
    {
        check: 'dependencies/lockfiles',
        files: {
            'package-lock.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
        },
        expected: { file: 'package-lock.json', rule: 'host', line: 2 },
        corrected: {
            files: {
                'package-lock.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
            },
        },
    },
    {
        check: 'dependencies/lockfiles',
        files: {
            'npm-shrinkwrap.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
        },
        expected: { file: 'npm-shrinkwrap.json', rule: 'host', line: 2 },
        corrected: {
            files: {
                'npm-shrinkwrap.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
            },
        },
    },
    {
        check: 'dependencies/lockfiles',
        files: {
            'pnpm-lock.yaml': `lockfileVersion: '9.0'
packages:
  a@1.0.0:
    resolution: {tarball: https://registry.example.test/a/-/a-1.0.0.tgz}
`,
        },
        expected: { file: 'pnpm-lock.yaml', rule: 'host', line: 4 },
        corrected: {
            files: {
                'pnpm-lock.yaml': `lockfileVersion: '9.0'
packages:
  a@1.0.0:
    resolution: {tarball: https://registry.npmjs.org/a/-/a-1.0.0.tgz}
`,
            },
        },
    },
    {
        check: 'dependencies/lockfiles',
        files: {
            'yarn.lock': `a@1.0.0:
  version "1.0.0"
  resolved "https://registry.example.test/a/-/a-1.0.0.tgz#0a1b"
`,
        },
        expected: { file: 'yarn.lock', rule: 'host', line: 3 },
        corrected: {
            files: {
                'yarn.lock': `a@1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/a/-/a-1.0.0.tgz#0a1b"
`,
            },
        },
    },
] as const;

/** An npm lockfile with downloads from two GitHub hosts. */
export const HOST_LOCKFILE = {
    packages: {
        'node_modules/first': { resolved: 'https://github.com/example/first/archive/abcdef.tar.gz' },
        'node_modules/second': { resolved: 'https://codeload.github.com/example/second/tar.gz/abcdef' },
        'node_modules/third': { resolved: 'https://github.com/example/third/archive/abcdef.tar.gz' },
    },
} as const;

/** A binary Bun lockfile whose URL the scanner must not read as text. */
export const BINARY_BUN_LOCKFILE = Buffer.concat([
    Buffer.from([0xff, 0]),
    Buffer.from('https://untrusted.invalid/package.tgz'),
]);

/** The lockfile result of each scope when only the root allows a registry host. */
export const REGISTRY_SCOPE_RESULTS: { scope: string; status: CheckResult['status']; files: string[] }[] = [
    { scope: '', status: 'failed', files: ['package-lock.json', 'package-lock.json', 'package-lock.json'] },
    { scope: 'app', status: 'passed', files: [] },
    {
        scope: 'sibling',
        status: 'failed',
        files: ['sibling/package-lock.json', 'sibling/package-lock.json', 'sibling/package-lock.json'],
    },
];

/** Each mise file that can pin bun. */
export const MISE_PIN_FILES = [
    { file: 'mise.toml' },
    { file: '.mise.toml' },
    { file: 'mise/config.toml' },
    { file: '.mise/config.toml' },
    { file: '.config/mise.toml' },
    { file: '.config/mise/config.toml' },
    { file: 'mise.local.toml' },
    { file: '.mise.local.toml' },
] as const;

/** The setting that allows both GitHub download hosts. */
export const ALLOWED_GITHUB_REGISTRIES = `allowed_registries = { value = ["github.com", "codeload.github.com"], reason = ${JSON.stringify(SETTING_REASON)} }\n`;

/** The Bun project with react-dom on the version of react. */
export const MATCHED_REACT_FILES = Object.fromEntries(
    Object.entries(BUN_PROJECT_FILES).map(([path, text]) => [path, text.replaceAll('19.0.0', '19.1.0')]),
);
