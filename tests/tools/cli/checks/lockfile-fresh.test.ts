import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { rmSync, existsSync, readFileSync } from 'node:fs';
import { containing } from '#tests/harness/expectations.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';

test.each([
    [process.execPath, 'bun.lock'],
    ['npm', 'package-lock.json'],
    ['yarn', 'yarn.lock'],
] as const)('native %s validates %s without changing repository inputs', async (client, lockName) => {
    await using directory = await testdir();
    const version = await processes.run([client, '--version'], { cwd: directory.path });
    expect(version.code, version.stdout + version.stderr).toBe(0);
    const yarnBerry = client === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= 2;
    const manifest = JSON.stringify({ private: true, dependencies: { library: 'file:./library' } });
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['dependencies']),
        'package.json': manifest,
        'library/package.json': '{"name":"library","version":"1.0.0"}\n',
        'other/package.json': '{"name":"other","version":"1.0.0"}\n',
        ...(yarnBerry ? { '.yarnrc.yml': 'nodeLinker: node-modules\n' } : {}),
    });
    const yarnFlags = yarnBerry ? [] : ['--non-interactive'];
    const lockFlag = client === 'npm' ? '--package-lock-only' : '--lockfile-only';
    const installed = await processes.run(
        [
            client,
            'install',
            ...(client === 'yarn' ? yarnFlags : [lockFlag]),
            ...(yarnBerry ? [] : ['--ignore-scripts']),
        ],
        {
            cwd: directory.path,
            ...(yarnBerry ? { env: { YARN_ENABLE_SCRIPTS: 'false', YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' } } : {}),
        },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    rmSync(join(directory.path, 'node_modules'), { recursive: true, force: true });
    const lock = readFileSync(join(directory.path, lockName));
    const changed = JSON.stringify({ private: true, dependencies: { other: 'file:./other' } });
    await Bun.write(join(directory.path, 'package.json'), changed);
    const session = await openSession(directory.path);
    const [planned] = planRun(session, {
        stage: 'push',
        skips: [],
        only: ['dependencies/lockfile-fresh'],
    });
    const input = engineInput(session, planned!);
    expect(await lockfileFresh(input)).toContainEqual(containing({ rule: 'stale' }));
    expect(readFileSync(join(directory.path, lockName))).toStrictEqual(lock);
    expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(changed);
    await Bun.write(join(directory.path, 'package.json'), manifest);
    expect(await lockfileFresh(input)).toStrictEqual([]);
    expect(readFileSync(join(directory.path, lockName))).toStrictEqual(lock);
    expect(existsSync(join(directory.path, 'node_modules'))).toBe(false);
});
