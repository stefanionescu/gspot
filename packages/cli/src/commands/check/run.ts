// check: open the session, honor the pin, run, render, decide the exit code.
import { relative, resolve } from 'node:path';
import type { CheckResult } from '#cli/checks/result.ts';
import type { RunReport } from '#cli/execution/report.ts';
import type { StageFilter } from '#cli/execution/plan.ts';
import { checkPushed } from '#cli/commands/check/push.ts';
import { checkContent } from '#cli/commands/check/content.ts';
import { refusalFor } from '#cli/commands/check/selection.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import { stagedFiles } from '#cli/repository/revisions/selection.ts';
import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
import { withRevisionSnapshot } from '#cli/repository/revisions/snapshot.ts';

// Checks an exact snapshot of the staged index, with the report published to the repository.
async function checkStaged(root: string, options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    if (options.fix)
        throw new SelectionError([
            'Staged checks do not run fixers. Run gspot check --fix and stage the reviewed changes.',
        ]);
    if (options.changed !== undefined) throw new SelectionError(['Choose --staged or --changed, not both.']);
    const set = await stagedFiles(root, signal);
    const refusal = refusalFor(options, options.stage ?? 'commit', set.staged);
    if (refusal !== undefined) return refusal;
    return withRevisionSnapshot(
        root,
        { kind: 'index' },
        async (snapshot, tree) => {
            const paths = options.paths.map((path) => relative(root, resolve(options.cwd, path)));
            return checkContent(snapshot, { ...options, cwd: snapshot, paths }, signal, {
                content: 'index',
                cacheRoot: root,
                reference: tree,
                staged: set,
                reportRoot: root,
            });
        },
        signal,
    );
}

/**
 * Check the working tree or an isolated, exact snapshot of the staged index.
 * @param options the parsed flags
 * @param signal cancellation for the run
 * @returns the text to print and the exit code
 */
export async function checkCommand(options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    if ((options.staged || options.push !== undefined) && !isGitRepository(root))
        throw new SelectionError(['Revision selection requires a Git repository.']);
    if (options.push !== undefined) return checkPushed(root, options, options.push, signal);
    if (!options.staged) return checkContent(root, options, signal);
    return checkStaged(root, options, signal);
}

export type CheckOptions = {
    onResult?: (result: CheckResult) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: { input: string; remote?: string };
    changed?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    skips: string[];
    messageFile?: string;
    quiet: boolean;
    verbose: boolean;
    noCache: boolean;
};

export type CheckCommandResult = CommandResult & { report?: RunReport };
