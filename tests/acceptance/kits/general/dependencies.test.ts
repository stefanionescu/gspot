// A stale Bun lockfile on an installed repository: the lockfile check fails, and regenerating the lock passes.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';

const DEPENDENCIES_INIT = [
    'init',
    '--yes',
    '--kits',
    'dependencies',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];

const CLEAN = `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@${Bun.version}"\n}\n`;

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
        const args = ['check', '--only', 'dependencies/lockfile-fresh', '--json'];
        const stale = await spawnGspot(sandbox.path, args, environment);
        expect(stale.code, stale.stdout + stale.stderr).toBe(1);
        expect((JSON.parse(stale.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'dependencies/lockfile-fresh',
                status: 'fail',
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
        const locked = await processes.run([process.execPath, 'install', '--lockfile-only', '--ignore-scripts'], {
            cwd: sandbox.path,
            env: environment,
        });
        expect(locked.code, locked.stdout + locked.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'bun.lock')).exists()).toBe(true);
        const corrected = await spawnGspot(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'dependencies/lockfile-fresh', status: 'ok', findings: [] },
        ]);
        const checked = await spawnGspot(sandbox.path, ['check', '--hook', 'commit', '--json'], environment);
        const ids = (JSON.parse(checked.stdout) as RunReport).checks.map(({ check }) => check);
        expect(ids).not.toContain('dependencies/osv');
        expect(ids).not.toContain('dependencies/syncpack');
    },
    PLANTED_TIMEOUT_MS * 2,
);
