import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

export const INVALID: (CaseChanges & Record<'expected', string>)[] = [
    {
        check: 'dependencies/package-json',
        files: { 'package.json': '{' },
        expected: 'Cannot inspect manifest package.json',
    },
    {
        check: 'dependencies/package-json',
        files: { 'package.json': '{"dependencies":{"example":false}}' },
        expected: 'Cannot inspect manifest package.json',
    },
    {
        check: 'dependencies/package-json',
        files: { 'package.json': '{"dependencies":{"example":5}}' },
        expected: 'Cannot inspect manifest package.json',
    },
];

export const CLEAN = `{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;

export const FOREIGN_PNPM =
    "lockfileVersion: '9.0'\npackages:\n  a@1.0.0:\n    resolution: {tarball: https://registry.example.test/a/-/a-1.0.0.tgz}\n";

export const FOREIGN_YARN =
    'a@1.0.0:\n  version "1.0.0"\n  resolved "https://registry.example.test/a/-/a-1.0.0.tgz#0a1b"\n';

export const REPOSITORY: InProcessScenario = {
    configurations: ['dependencies'],

    files: { 'package.json': CLEAN },
};

export const CASES: FindingCase[] = [
    {
        check: 'dependencies/bun-release-age',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 3600\n' },
        expected: { file: 'bunfig.toml', rule: 'release-age', line: 1 },
        corrected: { files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' } },
    },
    {
        check: 'dependencies/bun-release-age',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' },
        policy: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        expected: { file: 'bunfig.toml', rule: 'security-scanner', line: 1 },
        corrected: {
            files: {
                'bun.lock': '{}\n',
                'bunfig.toml':
                    '[install]\nminimumReleaseAge = 604800\n[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
            },
        },
    },

    {
        check: 'dependencies/lockfile-hosts',
        files: {
            'package-lock.json':
                '{\n    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }\n}\n',
        },
        expected: { file: 'package-lock.json', rule: 'host', line: 2 },
        corrected: {
            files: {
                'package-lock.json':
                    '{\n    "packages": { "node_modules/a": { "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }\n}\n',
            },
        },
    },
    {
        check: 'dependencies/lockfile-hosts',
        files: {
            'npm-shrinkwrap.json':
                '{\n    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }\n}\n',
        },
        expected: { file: 'npm-shrinkwrap.json', rule: 'host', line: 2 },
        corrected: {
            files: {
                'npm-shrinkwrap.json':
                    '{\n    "packages": { "node_modules/a": { "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }\n}\n',
            },
        },
    },
    {
        check: 'dependencies/lockfile-hosts',
        files: { 'pnpm-lock.yaml': FOREIGN_PNPM },
        expected: { file: 'pnpm-lock.yaml', rule: 'host', line: 4 },
        corrected: {
            files: {
                'pnpm-lock.yaml':
                    "lockfileVersion: '9.0'\npackages:\n  a@1.0.0:\n    resolution: {tarball: https://registry.npmjs.org/a/-/a-1.0.0.tgz}\n",
            },
        },
    },
    {
        check: 'dependencies/lockfile-hosts',
        files: { 'yarn.lock': FOREIGN_YARN },
        expected: { file: 'yarn.lock', rule: 'host', line: 3 },
        corrected: {
            files: {
                'yarn.lock':
                    'a@1.0.0:\n  version "1.0.0"\n  resolved "https://registry.yarnpkg.com/a/-/a-1.0.0.tgz#0a1b"\n',
            },
        },
    },
];
