// Planted repository for the dependencies configuration: a version range, a second package manager, a public workspace root, a stale lockfile.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/harness/cli/command.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { INVALID } from '#tests/inputs/acceptance/source/kits/kits.ts';
import { runPlanted, plantedCases } from '#tests/harness/planted/cases.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';
import { DEPENDENCIES_INIT } from '#tests/inputs/acceptance/source/kits/init-arguments.ts';

const CLEAN = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;
const FOREIGN_LOCK =
    '{\n    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }\n}\n';

plantedCases(
    'the dependencies configuration',
    {
        kits: ['dependencies'],
        modules: false,
        without: [],
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
                const outcome = await runPlanted(root, invalid, environment);
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(2);
                expect(outcome.stdout + outcome.stderr).toContain(invalid.expected);
                const corrected = await run(root, ['check', '--only', invalid.check, '--json'], environment);
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                    { check: invalid.check, status: 'ok', findings: [] },
                ]);
            },
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);

test(
    'the dependencies configuration > a stale Bun lock fails, regenerating it passes, and advisory checks wait for their stage',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': CLEAN });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['typos', 'ec']) };
        await installAtLevel(sandbox.path, DEPENDENCIES_INIT, environment);
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
        const args = ['check', '--only', 'integrity/lockfile-fresh', '--json'];
        const stale = await run(sandbox.path, args, environment);
        expect(stale.code, stale.stdout + stale.stderr).toBe(1);
        expect((JSON.parse(stale.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'integrity/lockfile-fresh',
                status: 'fail',
                findings: [
                    containing({
                        file: 'bun.lock',
                        rule: 'stale-lockfile',
                        line: 1,
                        message: textContaining('refuses this lockfile'),
                    }),
                ],
            },
        ]);
        const locked = await processes.run([process.execPath, 'install', '--lockfile-only', '--ignore-scripts'], {
            cwd: sandbox.path,
            env: environment,
        });
        expect(locked.code, locked.stdout + locked.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'bun.lock')).exists()).toBe(true);
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'integrity/lockfile-fresh', status: 'ok', findings: [] },
        ]);
        const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
        const ids = (JSON.parse(checked.stdout) as RunReport).checks.map(({ check }) => check);
        expect(ids).not.toContain('dependencies/osv');
        expect(ids).not.toContain('dependencies/syncpack');
    },
    PLANTED_TIMEOUT_MS * 2,
);
