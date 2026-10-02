// The built-in dependency checks on a planted repository, run in-process: install policy, lockfile hosts, and manifests.
import { test, expect } from 'bun:test';
import type { PlantedInput } from '#tests/types/cli.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { runPlanted, plantedCases } from '#tests/harness/planted/cases.ts';

const INVALID: (PlantedInput & { expected: string })[] = [
    {
        check: 'integrity/manifest-policy',
        files: { 'package.json': '{' },
        expected: 'Cannot read package manifest package.json',
    },
    {
        check: 'integrity/manifest-policy',
        files: { 'package.json': '{"dependencies":{"example":false}}' },
        expected: 'Cannot read package manifest package.json',
    },
];

const CLEAN = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;
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
            check: 'integrity/install-policy',
            files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 3600\n' },
            expected: { file: 'bunfig.toml', rule: 'release-age', line: 1 },
            corrected: { files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' } },
        },
        {
            check: 'integrity/install-policy',
            files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' },
            policy: '[tools.install]\nsecurity_scanner = "@socketsecurity/bun-security-scanner"\n',
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
            check: 'integrity/lockfile-hosts',
            files: { 'package-lock.json': FOREIGN_LOCK },
            expected: { file: 'package-lock.json', rule: 'registry', line: 2 },
            corrected: {
                files: { 'package-lock.json': FOREIGN_LOCK.replace('registry.example.test', 'registry.npmjs.org') },
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
                    { check: invalid.check, status: 'ok', findings: [] },
                ]);
            },
        );
    },
);
