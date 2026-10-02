// check: open the session, honor the pin, run, render, decide the exit code.
import { resolve, relative } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { checkPush } from '#cli/commands/check/push.ts';
import { checkContent } from '#cli/commands/check/content.ts';
import { refusalFor } from '#cli/commands/check/selection.ts';
import type { CheckOptions } from '#cli/types/commands/check.ts';
import { getStaged } from '#cli/repository/revisions/changes.ts';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import { checkOutRevision } from '#cli/execution/checkout/revision.ts';
import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
// Checks an exact snapshot of the staged index, with the report published to the repository.
async function checkStaged(root: string, options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    if (options.fix)
        throw new GspotError('selection', [
            'Staged checks do not run fixers. Run gspot check --fix and stage the reviewed changes.',
        ]);
    if (options.changed !== undefined) throw new GspotError('selection', ['Choose --staged or --changed, not both.']);
    const set = await getStaged(root, signal);
    const refusal = refusalFor(options, options.stage ?? 'commit', set.staged);
    if (refusal !== undefined) return refusal;
    return checkOutRevision(
        root,
        { kind: 'index' },
        async (revisionRoot, tree) => {
            const paths = options.paths.map((path) => relative(root, resolve(options.cwd, path)));
            return checkContent(revisionRoot, { ...options, cwd: revisionRoot, paths }, signal, {
                content: 'index',
                installedRoot: root,
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
        throw new GspotError('selection', ['Revision selection requires a Git repository.']);
    if (options.push !== undefined) return checkPush(root, options, options.push, signal);
    if (!options.staged) return checkContent(root, options, signal);
    return checkStaged(root, options, signal);
}
