import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rm, readFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { NATIVE_LOCKFILES } from '#tests/config/tools/configurations/general/dependencies/lockfiles.ts';

test.each([...NATIVE_LOCKFILES])(
    'native $name validates $lockfileName without changing repository inputs',
    async ({ command: [client, ...commandArguments], lockfileName, manifestPath, manifest, changed, files }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['dependencies']),
            [manifestPath]: manifest,
            ...files,
        });
        const executable = client === 'bun' ? process.execPath : client;
        const installed = await runTestCommand([executable, ...commandArguments], { cwd: directory.path });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        await rm(join(directory.path, 'node_modules'), { recursive: true, force: true });
        const lockfile = await readFile(join(directory.path, lockfileName));
        await Bun.write(join(directory.path, manifestPath), changed);
        const session = await openSession(directory.path);
        const [planned] = planRun(session, {
            stage: 'push',
            skips: [],
            only: ['dependencies/stale-lockfile'],
        });
        const input = checkInput(session, planned!);
        expect(await BUILT_IN_CHECKS['dependencies/stale-lockfile'].input(input)).toContainEqual(
            containing({ rule: 'stale' }),
        );
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await readFile(join(directory.path, manifestPath), 'utf8')).toBe(changed);
        await Bun.write(join(directory.path, manifestPath), manifest);
        expect(await BUILT_IN_CHECKS['dependencies/stale-lockfile'].input(input)).toStrictEqual([]);
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await pathExists(join(directory.path, 'node_modules'))).toBe(false);
    },
);
