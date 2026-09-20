// The acceptance run: a detached worktree of a reference repository, gspot installed and run inside it, the worktree removed.
// The reference repository itself is never written: its working tree and its branches stay as they were.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { git, run } from '#tests/harness/planted.ts';
import { reportSchema } from '#cli/run/report/schema.ts';
import type { AcceptanceRun } from '#tests/types/acceptance.ts';

function removeWorktree(repository: string, worktree: string): void {
    const removed = git(repository, ['worktree', 'remove', '--force', worktree]);
    if (removed.code !== 0) throw new Error(`Reference worktree cleanup failed at ${worktree}: ${removed.stderr}`);
}

/**
 * Installs gspot in a detached worktree of a repository, runs every check, and removes the worktree.
 * @param repository the reference repository
 * @returns the successful init output and validated check report
 */
export async function acceptanceRun(repository: string): Promise<AcceptanceRun> {
    const holder = mkdtempSync(join(tmpdir(), 'gspot-acceptance-'));
    const worktree = join(holder, 'tree');
    let isAdded = false;
    try {
        const added = git(repository, ['worktree', 'add', '--detach', worktree, 'HEAD']);
        if (added.code !== 0) throw new Error(`The worktree of ${repository} was not created: ${added.stderr}`);
        isAdded = true;
        const init = await run(worktree, ['init', '--yes', '--no-install', '--no-hooks', '--no-ci']);
        if (init.code !== 0) throw new Error(`Reference init failed: ${init.stderr}${init.stdout}`);
        const checked = await run(worktree, ['check', '--stage', 'commit', '--no-cache', '--json']);
        const report = reportSchema.parse(JSON.parse(checked.stdout));
        if (checked.code !== report.exitCode)
            throw new Error(`Reference check exit ${String(checked.code)} disagrees with its report.`);
        return { init: init.stdout, report };
    } finally {
        if (isAdded) removeWorktree(repository, worktree);
        rmSync(holder, { recursive: true, force: true });
    }
}
