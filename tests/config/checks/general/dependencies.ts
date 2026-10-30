import { SETTING_REASON } from '#tests/config/commands/set.ts';

export const BUN_PROJECT_FILES = {
    'package.json': JSON.stringify({
        name: 'shop',
        private: true,
        dependencies: { zod: '^4.1.0', react: '19.1.0', 'react-dom': '19.0.0' },
        devDependencies: { typescript: '0.0.0-test' },
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

export const DEPENDENCIES_SANDBOX = {
    configurations: ['dependencies'],

    files: {
        'package.json': `{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@1.4.2"\n}\n`,
    },
} as const;

export const LOCKFILE_HOST_CASES = [
    {
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

export const HOST_LOCKFILE = {
    packages: {
        'node_modules/first': { resolved: 'https://github.com/example/first/archive/abcdef.tar.gz' },
        'node_modules/second': { resolved: 'https://codeload.github.com/example/second/tar.gz/abcdef' },
        'node_modules/third': { resolved: 'https://github.com/example/third/archive/abcdef.tar.gz' },
    },
} as const;

export const REGISTRY_SCOPE_RESULTS = [
    { scope: '', status: 'failed' as const, files: ['package-lock.json', 'package-lock.json', 'package-lock.json'] },
    { scope: 'app', status: 'passed' as const, files: [] },
    {
        scope: 'sibling',
        status: 'failed' as const,
        files: ['sibling/package-lock.json', 'sibling/package-lock.json', 'sibling/package-lock.json'],
    },
];

export const MISE_PIN_FILES = [{ file: 'mise.toml' }] as const;

export const ALLOWED_GITHUB_REGISTRIES = `allowed_registries = { value = ["github.com", "codeload.github.com"], reason = ${JSON.stringify(SETTING_REASON)} }\n`;

export const LOCKFILE_DOWNLOAD_CASES = [
    {
        name: 'a registry tarball beside a deprecation link',
        path: 'pnpm-lock.yaml',
        text: 'packages:\n  pkg@1.0.0:\n    resolution: {tarball: https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz}\n    deprecated: See https://eslint.org/version-support\n',
        lines: [],
    },
    {
        name: 'a repository resolution',
        path: 'pnpm-lock.yaml',
        text: 'packages:\n  pkg@1.0.0:\n    resolution: {repo: https://github.com/org/pkg.git, commit: abc}\n',
        lines: [3],
    },
    {
        name: 'a resolved archive beside a homepage',
        path: 'yarn.lock',
        text: 'pkg@1:\n  resolved "https://github.com/org/pkg/archive/v1.tar.gz"\n  homepage "https://example.com"\n',
        lines: [2],
    },
    {
        name: 'an archive resolution beside a description',
        path: 'yarn.lock',
        text: '"pkg@https://github.com/org/pkg/archive/v1.tar.gz":\n  resolution: "pkg@https://github.com/org/pkg/archive/v1.tar.gz"\n  description: "See https://example.com"\n',
        lines: [2],
    },
    {
        name: 'a package archive beside a description',
        path: 'bun.lock',
        text: '{"packages": {"pkg": ["pkg@1.0.0", "https://github.com/org/pkg/archive/v1.tar.gz", {}, "sha512-hash"]}, "description": "See https://example.com"}',
        lines: [1],
    },
] as const;

export const BUN_PIN_SETTINGS = '[tools]\nbun = "0.0.0-test.2"\n';
