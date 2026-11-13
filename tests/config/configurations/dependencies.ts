import { SETTING_REASON } from '#tests/config/setup/sandboxes.ts';

export const LOCKFILE_HOST_CASES = [
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

export const ALLOWED_GITHUB_REGISTRIES = `allowed_registries = { value = ["github.com", "codeload.github.com"], reason = ${JSON.stringify(SETTING_REASON)} }\n`;

export const LOCKFILE_DOWNLOAD_CASES = [
    {
        name: 'a repository resolution',
        path: 'pnpm-lock.yaml',
        text: 'packages:\n  pkg@1.0.0:\n    resolution: {repo: https://github.com/org/pkg.git, commit: abc}\n',
        lines: [3],
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

export const BUN_SCANNER_KEYS = [
    {
        path: 'apps/api/bunfig.toml',
        keys: [{ key: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
    },
];
