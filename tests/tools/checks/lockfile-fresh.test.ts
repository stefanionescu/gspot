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
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';

test.each([
    [process.execPath, 'bun.lock'],
    ['npm', 'package-lock.json'],
    ['yarn', 'yarn.lock'],
] as const)('native %s validates %s without changing repository inputs', async (client, lockfileName) => {
    await using directory = await testdir();
    const version = await runTestCommand([client, '--version'], { cwd: directory.path });
    expect(version.code, version.stdout + version.stderr).toBe(0);
    const yarnBerry = client === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= 2;
    const manifest = JSON.stringify({ private: true, dependencies: { library: 'file:./library' } });
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['dependencies']),
        'package.json': manifest,
        'library/package.json': '{"name":"library","version":"1.0.0"}\n',
        'other/package.json': '{"name":"other","version":"1.0.0"}\n',
        ...(yarnBerry ? { '.yarnrc.yml': 'nodeLinker: node-modules\n' } : {}),
    });
    const yarnFlags = yarnBerry ? [] : ['--non-interactive'];
    const lockfileFlag = client === 'npm' ? '--package-lock-only' : '--lockfile-only';
    const installed = await runTestCommand(
        [
            client,
            'install',
            ...(client === 'yarn' ? yarnFlags : [lockfileFlag]),
            ...(yarnBerry ? [] : ['--ignore-scripts']),
        ],
        {
            cwd: directory.path,
            ...(yarnBerry ? { env: { YARN_ENABLE_SCRIPTS: 'false', YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' } } : {}),
        },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await rm(join(directory.path, 'node_modules'), { recursive: true, force: true });
    const lockfile = await readFile(join(directory.path, lockfileName));
    const changed = JSON.stringify({ private: true, dependencies: { other: 'file:./other' } });
    await Bun.write(join(directory.path, 'package.json'), changed);
    const session = await openSession(directory.path);
    const [planned] = planRun(session, {
        stage: 'push',
        skips: [],
        only: ['dependencies/lockfile-fresh'],
    });
    const input = checkInput(session, planned!);
    expect(await lockfileFresh(input)).toContainEqual(containing({ rule: 'stale' }));
    expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
    expect(await readFile(join(directory.path, 'package.json'), 'utf8')).toBe(changed);
    await Bun.write(join(directory.path, 'package.json'), manifest);
    expect(await lockfileFresh(input)).toStrictEqual([]);
    expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
    expect(await pathExists(join(directory.path, 'node_modules'))).toBe(false);
});
