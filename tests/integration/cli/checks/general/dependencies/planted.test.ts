// The built-in dependency checks on a planted repository, run in-process: install policy, lockfile hosts, and manifests.
import { test, expect } from 'bun:test';
import type { PlantedInput } from '#tests/types/cli.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { runPlanted, plantedCases } from '#tests/harness/planted/cases.ts';

const INVALID: (PlantedInput & { expected: string })[] = [
    {
        check: 'dependencies/manifests',
        files: { 'package.json': '{' },
        expected: 'Cannot read package manifest package.json',
    },
    {
        check: 'dependencies/manifests',
        files: { 'package.json': '{"dependencies":{"example":false}}' },
        expected: 'Cannot read package manifest package.json',
    },
];

const CLEAN = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;
const FOREIGN_PNPM =
    "lockfileVersion: '9.0'\npackages:\n  a@1.0.0:\n    resolution: {tarball: https://registry.example.test/a/-/a-1.0.0.tgz}\n";
const FOREIGN_YARN = 'a@1.0.0:\n  version "1.0.0"\n  resolved "https://registry.example.test/a/-/a-1.0.0.tgz#0a1b"\n';
const FOREIGN_LOCK =
    '{\n    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }\n}\n';

plantedCases(
    'the dependencies configuration',
    {
        kits: ['dependencies'],
        modules: false,
        installs: false,
        files: { 'package.json': CLEAN },
    },
    [
        {
            check: 'dependencies/install',
            files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 3600\n' },
            expected: { file: 'bunfig.toml', rule: 'release-age', line: 1 },
            corrected: { files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' } },
        },
        {
            check: 'dependencies/install',
            files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' },
            policy: '[install]\nscanner = "@socketsecurity/bun-security-scanner"\n',
            expected: { file: 'bunfig.toml', rule: 'security-scanner', line: 1 },
            corrected: {
                files: {
                    'bun.lock': '{}\n',
                    'bunfig.toml':
                        '[install]\nminimumReleaseAge = 604800\n[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
                },
            },
        },
        ...['package-lock.json', 'npm-shrinkwrap.json'].map((lockfile) => ({
            check: 'dependencies/lockfile-hosts',
            files: { [lockfile]: FOREIGN_LOCK },
            expected: { file: lockfile, rule: 'host', line: 2 },
            corrected: { files: { [lockfile]: FOREIGN_LOCK.replace('registry.example.test', 'registry.npmjs.org') } },
        })),
        {
            check: 'dependencies/lockfile-hosts',
            files: { 'pnpm-lock.yaml': FOREIGN_PNPM },
            expected: { file: 'pnpm-lock.yaml', rule: 'host', line: 4 },
            corrected: {
                files: { 'pnpm-lock.yaml': FOREIGN_PNPM.replace('registry.example.test', 'registry.npmjs.org') },
            },
        },
        {
            check: 'dependencies/lockfile-hosts',
            files: { 'yarn.lock': FOREIGN_YARN },
            expected: { file: 'yarn.lock', rule: 'host', line: 3 },
            corrected: {
                files: { 'yarn.lock': FOREIGN_YARN.replace('registry.example.test', 'registry.yarnpkg.com') },
            },
        },
    ],
    (planted) => {
        test.each(INVALID)(
            'invalid manifest $files refuses execution and accepts a valid manifest',
            async (invalid) => {
                const { root, environment } = planted();
                const outcome = await runPlanted(root, invalid, environment, true);
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(2);
                expect(outcome.stdout + outcome.stderr).toContain(invalid.expected);
                const corrected = await runGspot(root, ['check', '--only', invalid.check, '--json'], environment);
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                    { check: invalid.check, status: 'passed', findings: [] },
                ]);
            },
        );
    },
);
