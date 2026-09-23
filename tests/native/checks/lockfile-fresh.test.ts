import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { lockfileFresh } from '#cli/checks/dependencies/lockfile/fresh.ts';
import { engineInput, runEngineCheck } from '#cli/run/engines.ts';
import { planRun } from '#cli/run/plan.ts';
import { openSession } from '#cli/run/session.ts';

test.each(['missing', 'deadline', 'cancellation', 'registry', 'authentication', 'unexpected'])(
    'frozen installation reports %s as inability, preserves the repository, and retries successfully',
    async (failure) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\npresets = ["dependencies"]\n',
            'package.json': '{"name":"example","private":true}\n',
            'bun.lock': 'original lock\n',
            'node_modules/protected.txt': 'installed dependency\n',
        });
        const session = await openSession(directory.path);
        const [planned] = await planRun(session, {
            stage: 'push',
            skips: [],
            only: ['integrity/lockfile-fresh'],
        });
        const copies: string[] = [];
        const spawn = spyOn(processes, 'run').mockImplementation(async (_command, options) => {
            copies.push(options.cwd);
            writeFileSync(join(options.cwd, 'bun.lock'), 'partial installation\n');
            mkdirSync(join(options.cwd, 'node_modules'), { recursive: true });
            writeFileSync(join(options.cwd, 'node_modules/protected.txt'), 'replacement dependency\n');
            return {
                code: 1,
                stdout: '',
                stderr:
                    failure === 'registry'
                        ? 'ConnectionRefused downloading package metadata'
                        : failure === 'authentication'
                          ? 'HTTP 401 Unauthorized'
                          : 'Installation failed.',
                duration: 1,
                missing: failure === 'missing',
                isTimedOut: failure === 'deadline',
                isCanceled: failure === 'cancellation',
            };
        });
        try {
            const result = await runEngineCheck(session, lockfileFresh, planned!);
            expect(result.status).toBe(failure === 'missing' ? 'missing' : 'error');
            expect(result.findings).toEqual([]);
            expect(readFileSync(join(directory.path, 'bun.lock'), 'utf8')).toBe('original lock\n');
            expect(readFileSync(join(directory.path, 'node_modules/protected.txt'), 'utf8')).toBe(
                'installed dependency\n',
            );
            expect(copies).toHaveLength(1);
            expect(copies.every((path) => !existsSync(path))).toBe(true);
            spawn.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
            expect((await runEngineCheck(session, lockfileFresh, planned!)).status).toBe('ok');
        } finally {
            spawn.mockRestore();
        }
    },
);

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
    const modernYarn = manager === 'yarn' && Number(version.stdout.trim().split('.')[0]) >= 2;
    const manifest = JSON.stringify({ private: true, dependencies: { library: 'file:./library' } });
    await createFileTree(directory.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\npresets = ["dependencies"]\n`,
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
    expect(readFileSync(join(directory.path, lockName))).toEqual(lock);
    expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(changed);
    await Bun.write(join(directory.path, 'package.json'), manifest);
    expect(await lockfileFresh(input)).toEqual([]);
    expect(readFileSync(join(directory.path, lockName))).toEqual(lock);
    expect(existsSync(join(directory.path, 'node_modules'))).toBe(false);
});
