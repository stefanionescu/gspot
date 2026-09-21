// The acceptance run: a detached worktree of a reference repository, gspot installed and run inside it, the worktree removed.
// The reference repository itself is never written: its working tree and its branches stay as they were.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, rmdirSync, writeFileSync } from 'node:fs';
import { reportSchema } from '#cli/run/report-schema.ts';
import { git, run } from '#tests/harness/planted.ts';
import type { AcceptanceInput, AcceptanceRun } from '#tests/types/acceptance.ts';

async function checkReport(worktree: string, checks: string[]): Promise<AcceptanceRun['report']> {
    const checked = await run(worktree, ['check', '--stage', 'commit', '--only', ...checks, '--no-cache', '--json']);
    if (checked.code !== 0 && checked.code !== 1)
        throw new Error(
            `Acceptance check failed with status ${String(checked.code)}: ${checked.stderr}${checked.stdout}`,
        );
    const report = reportSchema.parse(JSON.parse(checked.stdout));
    if (report.exitCode !== checked.code)
        throw new Error('Acceptance report exit status disagrees with the process exit status.');
    return report;
}

/**
 * Initializes a detached worktree and checks the specified defects before and after correction.
 * @param input the repository, required checks, and corrected contents
 * @returns the init output and both reports
 */
export async function acceptanceRun(input: AcceptanceInput): Promise<AcceptanceRun> {
    const { repository, checks, corrections } = input;
    const holder = mkdtempSync(join(tmpdir(), 'gspot-acceptance-'));
    const worktree = join(holder, 'tree');
    const added = git(repository, ['worktree', 'add', '--detach', worktree, 'HEAD']);
    if (added.code !== 0) {
        if (!existsSync(worktree)) rmdirSync(holder);
        throw new Error(`The worktree of ${repository} was not created: ${added.stderr}. Inspect ${holder}.`);
    }
    let failure: unknown;
    try {
        const init = await run(worktree, ['init', '--yes', '--no-install', '--no-hooks', '--no-ci', '--no-runner']);
        if (init.code !== 0)
            throw new Error(`Acceptance init failed with status ${String(init.code)}: ${init.stderr}${init.stdout}`);
        if (!existsSync(join(worktree, 'gspot.toml'))) throw new Error('Acceptance init wrote no policy.');
        const report = await checkReport(worktree, checks);
        for (const [path, content] of Object.entries(corrections)) writeFileSync(join(worktree, path), content);
        const corrected = await checkReport(worktree, checks);
        return { init: init.stdout, report, corrected };
    } catch (error) {
        failure = error;
        throw error;
    } finally {
        try {
            const removed = git(repository, ['worktree', 'remove', '--force', worktree]);
            if (removed.code !== 0)
                throw new Error(`Acceptance cleanup failed: ${removed.stderr}. Worktree retained at ${worktree}.`);
            rmdirSync(holder);
        } catch (error) {
            if (failure !== undefined)
                throw new AggregateError([failure, error], 'Acceptance execution and cleanup failed.');
            throw error;
        }
    }
}
