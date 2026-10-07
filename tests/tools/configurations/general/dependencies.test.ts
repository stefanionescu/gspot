// A stale Bun lockfile on an installed repository: the lockfile check fails, and regenerating the lockfile passes.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { install, buildToolsPath } from '#tests/harness/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { CLEAN, DEPENDENCIES_INIT } from '#tests/config/tools/configurations/general/dependencies.ts';

test(
    'the dependencies configuration > an outdated Bun lockfile fails, regenerating it passes, and advisory checks wait for their stage',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': CLEAN });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['typos', 'ec']) };
        await install(sandbox.path, DEPENDENCIES_INIT, environment, { level: 'all' });
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
            '{"lockfileVersion":1,"workspaces":{"":{"name":"example"}},"packages":{}}\n',
        );
        const args = ['check', '--only', 'dependencies/lockfile-fresh', '--json'];
        const stale = await spawnGspot(sandbox.path, args, environment);
        expect(stale.code, stale.stdout + stale.stderr).toBe(1);
        expect((JSON.parse(stale.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'dependencies/lockfile-fresh',
                status: 'failed',
                findings: [
                    containing({
                        file: 'bun.lock',
                        rule: 'stale',
                        line: 1,
                        message: textContaining('refuses this lockfile'),
                    }),
                ],
            },
        ]);
        const lockfileResult = await runTestCommand(
            [process.execPath, 'install', '--lockfile-only', '--ignore-scripts'],
            {
                cwd: sandbox.path,
                env: environment,
            },
        );
        expect(lockfileResult.code, lockfileResult.stdout + lockfileResult.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'bun.lock')).exists()).toBe(true);
        const corrected = await spawnGspot(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'dependencies/lockfile-fresh', status: 'passed', findings: [] },
        ]);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const staged = ['check', '--hook', 'pre-commit', '--only'];
        const checks = ['dependencies/manifests', 'dependencies/osv', 'dependencies/syncpack'];
        const checked = await spawnGspot(sandbox.path, [...staged, ...checks, '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const ids = (JSON.parse(checked.stdout) as RunReport).checks.map(({ check }) => check);
        expect(ids).toContain('dependencies/manifests');
        expect(ids).not.toContain('dependencies/osv');
        expect(ids).not.toContain('dependencies/syncpack');
    },
    NATIVE_TEST_TIMEOUT_MS,
);
