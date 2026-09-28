import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readHookStatus } from '#tests/support/cli/hooks/projects.ts';
import { installHookClone, prepareHookClone } from '#tests/support/cli/hooks/clone.ts';

test.each(['lefthook', 'simple-git-hooks', 'husky', 'pre-commit'] as const)(
    'fresh clones install repeatedly without tracked changes with %s',
    async (hookTool) => {
        await using repository = await testdir();
        await using clone = await testdir();
        const project = await prepareHookClone(repository.path, clone.path, hookTool);
        const { main } = project;
        expect(existsSync(join(clone.path, '.gspot/state/ownership.json'))).toBe(false);
        expect(existsSync(join(clone.path, 'node_modules'))).toBe(false);
        expect(await readHookStatus(clone.path)).toMatchObject({ ready: false });
        const lockPath = join(clone.path, hookTool === 'pre-commit' ? 'uv.lock' : 'package-lock.json');
        const lock = readFileSync(lockPath);
        for (let attempt = 0; attempt < 2; attempt++) {
            const hooks = await installHookClone(project);
            expect(hooks.code, hooks.stdout + hooks.stderr).toBe(0);
            expect(await readHookStatus(clone.path)).toMatchObject({ ready: true });
            const applied = await run([process.execPath, main, 'apply'], { cwd: clone.path, timeoutMs: 60_000 });
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await readHookStatus(clone.path)).toMatchObject({ ready: true });
            const status = await run(['git', 'status', '--porcelain'], { cwd: clone.path });
            expect(status.code, status.stderr).toBe(0);
            const diff = await run(['git', 'diff'], { cwd: clone.path });
            expect(status.stdout, diff.stdout).toBe('');
            expect(readFileSync(lockPath)).toStrictEqual(lock);
        }
    },
    90_000,
);

test.each(['lefthook', 'simple-git-hooks', 'husky', 'pre-commit'] as const)(
    'fresh clone hooks reject indexed defects and accept corrected real commits with %s',
    async (hookTool) => {
        await using repository = await testdir();
        await using clone = await testdir();
        const project = await prepareHookClone(repository.path, clone.path, hookTool);
        const { options } = project;
        const installed = await installHookClone(project);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const commit = [
            'git',
            '-c',
            'user.name=Fixture',
            '-c',
            'user.email=fixture@example.test',
            'commit',
            '-qm',
            'test: staged source',
        ];
        writeFileSync(join(clone.path, 'source.txt'), 'forbidden\n');
        const ran = await run(['git', 'add', 'source.txt'], options);
        expect(ran.code).toBe(0);
        writeFileSync(join(clone.path, 'source.txt'), 'corrected in working tree\n');
        const failed = await run(commit, options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.stdout + failed.stderr).toContain('forbidden source token');
        expect(readFileSync(join(clone.path, 'source.txt'), 'utf8')).toBe('corrected in working tree\n');
        expect(readFileSync(join(clone.path, '.hook-read'), 'utf8')).toBe('authored');
        const staged = await run(['git', 'add', 'source.txt'], options);
        expect(staged.code).toBe(0);
        const corrected = await run(commit, options);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(readFileSync(join(clone.path, '.hook-read'), 'utf8')).toBe('authoredauthored');
        const status = await run(['git', 'status', '--porcelain'], options);
        expect(status.code, status.stderr).toBe(0);
        expect(status.stdout).toBe('');
    },
    90_000,
);

test.each(['lefthook', 'simple-git-hooks', 'husky', 'pre-commit'] as const)(
    'uninstall from a fresh clone removes local dispatchers without tracked changes with %s',
    async (hookTool) => {
        await using repository = await testdir();
        await using clone = await testdir();
        const project = await prepareHookClone(repository.path, clone.path, hookTool);
        const { main, options } = project;
        const installed = await installHookClone(project);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(await run([process.execPath, main, 'apply'], options)).toMatchObject({ code: 0 });
        const removed = await run([process.execPath, main, 'uninstall', '--yes'], options);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(existsSync(join(clone.path, '.git/hooks/pre-commit'))).toBe(false);
        expect(existsSync(join(clone.path, '.git/hooks/pre-commit.gspot-manager'))).toBe(false);
        expect(existsSync(join(clone.path, '.gspot/state/ownership.json'))).toBe(true);
        const restored = await run(['git', 'status', '--porcelain'], options);
        expect(restored.code, restored.stderr).toBe(0);
        expect(restored.stdout).toBe('');
    },
    90_000,
);
