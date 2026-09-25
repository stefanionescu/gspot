import { reportSchema } from '#cli/execution/report.ts';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { PlantedCase, FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the dependencies configuration: a version range, a second package manager, a public workspace root, a stale lockfile.
import { PLANTED_TIMEOUT_MS, run, runProcess } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'dependencies',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CLEAN = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;
const RANGED = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}",\n    "dependencies": {\n        "left-pad": "^1.3.0"\n    }\n}\n`;
const PUBLIC_ROOT = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "packageManager": "bun@${Bun.version}",\n    "workspaces": ["packages/*"]\n}\n`;

// The scheme arrives as an argument, because a fixer rewrites a plain-text URL without TLS into one with it.
function lockfileFrom(scheme: string): string {
    return `{\n    "packages": { "node_modules/a": { "resolved": "${scheme}://registry.example.test/a/-/a-1.0.0.tgz" } }\n}\n`;
}

const INVALID: PlantedCase[] = [
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

const CASES: (FindingCase & { corrected: Record<string, string> })[] = [
    {
        check: 'integrity/install-policy',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 3600\n' },
        expected: { file: 'bunfig.toml', rule: 'release-age', line: 1 },
        corrected: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' },
    },
    {
        check: 'integrity/install-policy',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' },
        policy: '[tools.install]\nsecurity_scanner = "@socketsecurity/bun-security-scanner"\n',
        expected: { file: 'bunfig.toml', rule: 'security-scanner', line: 1 },
        corrected: {
            'bun.lock': '{}\n',
            'bunfig.toml':
                '[install]\nminimumReleaseAge = 604800\n[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        },
    },
    {
        check: 'integrity/lockfile-hosts',
        files: {
            'package-lock.json': lockfileFrom('http'),
        },
        expected: { file: 'package-lock.json', rule: 'registry', line: 2 },
        corrected: {
            'package-lock.json': lockfileFrom('https').replace('registry.example.test', 'registry.npmjs.org'),
        },
    },
    {
        check: 'integrity/lockfile-hosts',
        files: {
            'package-lock.json': lockfileFrom('https'),
        },
        expected: { file: 'package-lock.json', rule: 'registry', line: 2 },
        corrected: {
            'package-lock.json': lockfileFrom('https').replace('registry.example.test', 'registry.npmjs.org'),
        },
    },
    {
        check: 'integrity/manifest-policy',
        files: { 'package.json': RANGED },
        expected: { file: 'package.json', rule: 'version-range', line: 1 },
        corrected: { 'package.json': RANGED.replace('^1.3.0', '1.3.0') },
    },
    {
        check: 'integrity/manifest-policy',
        files: { 'package.json': PUBLIC_ROOT },
        expected: { file: 'package.json', rule: 'private-root', line: 1 },
        corrected: {
            'package.json': PUBLIC_ROOT.replace('    "workspaces"', '    "private": true,\n    "workspaces"'),
        },
    },
    {
        check: 'integrity/manifest-policy',
        files: { 'bun.lock': '{}\n', 'package-lock.json': '{}\n' },
        expected: { file: 'package-lock.json', rule: 'foreign-lockfile', line: 1 },
        corrected: { 'bun.lock': '{}\n' },
    },
];

describe('the dependencies configuration', () => {
    test.each(INVALID)(
        'invalid manifest $files refuses execution and accepts a valid manifest',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'package.json': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(2);
            expect(outcome.stdout + outcome.stderr).toContain(planted.expected);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 2,
    );

    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts corrected metadata',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'package.json': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            const corrected = await runPlanted(sandbox.path, { ...planted, files: planted.corrected }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 2,
    );

    test(
        'a stale Bun lock fails, regenerating it passes, and advisory checks wait for their stage',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'package.json': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await createFileTree(sandbox.path, {
                'package.json': JSON.stringify({
                    ...JSON.parse(CLEAN),
                    workspaces: ['packages/*'],
                    dependencies: { 'local-fixture': 'workspace:*' },
                }),
                'packages/local/package.json': '{"name":"local-fixture","version":"1.0.0","private":true}\n',
            });
            await Bun.write(
                join(sandbox.path, 'bun.lock'),
                '{"lockfileVersion":1,"workspaces":{"":{"name":"planted"}},"packages":{}}\n',
            );
            const args = ['check', '--only', 'integrity/lockfile-fresh', '--no-cache', '--json'];
            const stale = await run(sandbox.path, args, environment);
            expect(stale.code, stale.stdout + stale.stderr).toBe(1);
            expect(reportSchema.parse(JSON.parse(stale.stdout)).checks).toMatchObject([
                {
                    check: 'integrity/lockfile-fresh',
                    status: 'fail',
                    findings: [
                        expect.objectContaining({
                            file: 'bun.lock',
                            rule: 'stale-lockfile',
                            line: 1,
                            message: expect.stringContaining('refuses this lockfile'),
                        }),
                    ],
                },
            ]);
            const locked = await runProcess([process.execPath, 'install', '--lockfile-only', '--ignore-scripts'], {
                cwd: sandbox.path,
                env: environment,
            });
            expect(locked.code, locked.stdout + locked.stderr).toBe(0);
            expect(await Bun.file(join(sandbox.path, 'bun.lock')).exists()).toBe(true);
            const corrected = await run(sandbox.path, args, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'integrity/lockfile-fresh', status: 'ok', findings: [] },
            ]);
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const ids = reportSchema.parse(JSON.parse(checked.stdout)).checks.map(({ check }) => check);
            expect(ids).not.toContain('dependencies/osv');
            expect(ids).not.toContain('dependencies/syncpack');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
