import { rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import * as processes from '#cli/platform/spawn.ts';
import { treeContents } from '#tests/harness/contents.ts';
import { acceptanceRun } from '#tests/harness/worktree.ts';
import { commitAll, git } from '#tests/harness/planted.ts';

test('failed initialization removes only its worktree and preserves existing worktrees and files', async () => {
    await using sandbox = await createSandbox({
        'repository/gspot.toml': 'version = [invalid\n',
        'repository/source.txt': 'committed\n',
    });
    const repository = join(sandbox.path, 'repository');
    commitAll(repository);
    const sibling = join(sandbox.path, 'existing');
    const added = git(repository, ['worktree', 'add', '--detach', sibling, 'HEAD']);
    expect(added.code, added.stderr).toBe(0);
    try {
        await Bun.write(join(repository, 'source.txt'), 'uncommitted edit\n');
        await Bun.write(join(repository, 'untracked.txt'), 'keep me\n');
        const before = treeContents(repository);
        const inventory = git(repository, ['worktree', 'list', '--porcelain']).stdout;
        await rejects(acceptanceRun(repository), /Reference init failed/);
        expect(git(repository, ['worktree', 'list', '--porcelain']).stdout).toBe(inventory);
        expect(treeContents(repository)).toEqual(before);
        expect(await Bun.file(join(sibling, 'source.txt')).text()).toBe('committed\n');
    } finally {
        const removed = git(repository, ['worktree', 'remove', '--force', sibling]);
        expect(removed.code, removed.stderr).toBe(0);
    }
});

test('a locked worktree reports cleanup failure and preserves the recovery location', async () => {
    await using sandbox = await createSandbox({ 'source.txt': 'committed\n' });
    commitAll(sandbox.path);
    let retained = '';
    const probe = spyOn(processes, 'run').mockImplementationOnce((_command, options) => {
        retained = options.cwd!;
        const locked = git(sandbox.path, ['worktree', 'lock', retained]);
        if (locked.code !== 0) throw new Error(locked.stderr);
        return Promise.resolve({ code: 1, stdout: '', stderr: 'init failed', missing: false, duration: 0 });
    });
    try {
        await rejects(acceptanceRun(sandbox.path), /Reference worktree cleanup failed at/);
        expect(await Bun.file(join(retained, 'source.txt')).text()).toBe('committed\n');
        expect(git(sandbox.path, ['worktree', 'list', '--porcelain']).stdout).toContain(retained);
    } finally {
        probe.mockRestore();
        if (retained !== '') {
            const unlocked = git(sandbox.path, ['worktree', 'unlock', retained]);
            expect(unlocked.code, unlocked.stderr).toBe(0);
            const removed = git(sandbox.path, ['worktree', 'remove', '--force', retained]);
            expect(removed.code, removed.stderr).toBe(0);
            rmdirSync(dirname(retained));
        }
    }
});
