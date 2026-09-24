import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { expect, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { engineInput } from '#cli/run/engines.ts';
import { lockfileFresh } from '#cli/checks/dependencies/lockfile/fresh.ts';
import { existsSync, readFileSync, rmSync } from 'node:fs';

test.each([
    [process.execPath, 'bun.lock', 'recommended'],
    ['npm', 'package-lock.json', 'recommended'],
    ['yarn', 'yarn.lock', 'recommended'],
    [process.execPath, 'bun.lock', 'all'],
    ['npm', 'package-lock.json', 'all'],
    ['yarn', 'yarn.lock', 'all'],
] as const)('native %s validates %s at %s without changing repository inputs', async (manager, lockName, level) => {
    await using directory = await testdir();
    const version = await processes.run([manager, '--version'], { cwd: directory.path });
    expect(version.code, version.stdout + version.stderr).toBe(0);
    const modernYarn = manager === 'yarn' && Number(version.stdout.trim().split('.', 1)[0]) >= 2;
    const manifest = JSON.stringify({ private: true, dependencies: { library: 'file:./library' } });
    await createFileTree(directory.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["dependencies"]\n`,
        'package.json': manifest,
        'library/package.json': '{"name":"library","version":"1.0.0"}\n',
        'other/package.json': '{"name":"other","version":"1.0.0"}\n',
        ...(modernYarn ? { '.yarnrc.yml': 'nodeLinker: node-modules\n' } : {}),
    });
    const installed = await processes.run(
        [
            manager,
            'install',
            ...(manager === 'yarn'
                ? modernYarn
                    ? []
                    : ['--non-interactive']
                : [manager === 'npm' ? '--package-lock-only' : '--lockfile-only']),
            ...(modernYarn ? [] : ['--ignore-scripts']),
        ],
        {
            cwd: directory.path,
            ...(modernYarn ? { env: { YARN_ENABLE_SCRIPTS: 'false', YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' } } : {}),
        },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    rmSync(join(directory.path, 'node_modules'), { recursive: true, force: true });
    const lock = readFileSync(join(directory.path, lockName));
    const changed = JSON.stringify({ private: true, dependencies: { other: 'file:./other' } });
    await Bun.write(join(directory.path, 'package.json'), changed);
    const session = await openSession(directory.path);
    const [planned] = await planRun(session, {
        stage: 'push',
        skips: [],
        only: ['integrity/lockfile-fresh'],
    });
    const input = engineInput(session, planned!);
    expect(await lockfileFresh(input)).toContainEqual(expect.objectContaining({ rule: 'stale-lockfile' }));
    expect(readFileSync(join(directory.path, lockName))).toStrictEqual(lock);
    expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(changed);
    await Bun.write(join(directory.path, 'package.json'), manifest);
    expect(await lockfileFresh(input)).toStrictEqual([]);
    expect(readFileSync(join(directory.path, lockName))).toStrictEqual(lock);
    expect(existsSync(join(directory.path, 'node_modules'))).toBe(false);
});
