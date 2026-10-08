import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { rm, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { NATIVE_LOCKFILES } from '#tests/config/tools/checks/lockfile-fresh.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';

test.each([...NATIVE_LOCKFILES])(
    'native $name validates $lockfileName without changing repository inputs',
    async ({ client, lockfileName, manifestPath, manifest, changed, files, arguments: commandArguments }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['dependencies']),
            [manifestPath]: manifest,
            ...files,
        });
        const command = client === 'bun' ? process.execPath : client;
        const installed = await runTestCommand([command, ...commandArguments], { cwd: directory.path });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        await rm(join(directory.path, 'node_modules'), { recursive: true, force: true });
        const lockfile = await readFile(join(directory.path, lockfileName));
        await Bun.write(join(directory.path, manifestPath), changed);
        const session = await openSession(directory.path);
        const [planned] = planRun(session, {
            stage: 'push',
            skips: [],
            only: ['dependencies/lockfile-fresh'],
        });
        const input = checkInput(session, planned!);
        expect(await lockfileFresh(input)).toContainEqual(containing({ rule: 'stale' }));
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await readFile(join(directory.path, manifestPath), 'utf8')).toBe(changed);
        await Bun.write(join(directory.path, manifestPath), manifest);
        expect(await lockfileFresh(input)).toStrictEqual([]);
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await pathExists(join(directory.path, 'node_modules'))).toBe(false);
    },
);
