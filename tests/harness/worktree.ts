// The acceptance run: a detached worktree of a reference repository, gspot installed and run inside it, the worktree removed.
// The reference repository itself is never written: its working tree and its branches stay as they were.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import type { RunRecord } from '#types/record.ts';
import type { AcceptanceRun } from '#types/run.ts';
import { git, run } from '#tests/harness/planted.ts';

/**
 * Installs gspot in a detached worktree of a repository, runs every check, and removes the worktree.
 * @param repository the reference repository
 * @returns the init output, the run record and the counts by status
 */
export async function acceptanceRun(repository: string): Promise<AcceptanceRun> {
    const holder = mkdtempSync(join(tmpdir(), 'gspot-acceptance-'));
    const worktree = join(holder, 'tree');
    const added = git(repository, ['worktree', 'add', '--detach', worktree, 'HEAD']);
    if (added.code !== 0) throw new Error(`The worktree of ${repository} was not created: ${added.stderr}`);
    try {
        const init = await run(worktree, ['init', '--yes', '--no-install', '--hooks', 'none', '--ci', 'none']);
        const checked = await run(worktree, ['check', '--at', 'commit', '--json']);
        const record = JSON.parse(checked.stdout) as RunRecord;
        const statuses: Record<string, number> = {};
        for (const check of record.checks) statuses[check.status] = (statuses[check.status] ?? 0) + 1;
        return { init: init.stdout, record, statuses };
    } finally {
        git(repository, ['worktree', 'remove', '--force', worktree]);
        rmSync(holder, { recursive: true, force: true });
    }
}
