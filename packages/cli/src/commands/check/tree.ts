// Checking one tree: the working tree, or a copy of the index or of a pushed commit.
import { runText } from '#cli/terminal/contracts.ts';
import { note, warn } from '#cli/terminal/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import type { StageFilter } from '#cli/types/planning.ts';
import { assertVersionPin } from '#cli/lifecycle/public.ts';
import { compact, codeList } from '#cli/platform/contracts.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { hookStatus } from '#cli/lifecycle/install/contracts.ts';
import type { RevisionSource } from '#cli/types/execution/copy.ts';
import { executeRun, reproduceLine } from '#cli/execution/public.ts';
import type { ChangedPaths } from '#cli/types/repository/revisions.ts';
import { getStaged, getChanged } from '#cli/repository/revisions/public.ts';
import { reconcileConfigurations } from '#cli/lifecycle/selection/contracts.ts';
import { selectedPaths, refuseUnknownChecks } from '#cli/commands/check/arguments.ts';
import type { FixReport, RunReport, RunOptions } from '#cli/types/execution/check.ts';
import type { Selections, CheckOptions, CheckCommandResult } from '#cli/types/commands/check.ts';

function reportFixes(fixes: FixReport, isDryRun: boolean, text: string): string {
    const failures = fixes.results.filter((result) => result.status === 'failed');
    for (const result of failures) warn(`a fixer failed: ${result.check}: ${result.note}`);
    const count = fixes.changed.length;
    const noun = count === 1 ? 'file' : 'files';
    if (isDryRun) {
        const verdict = count === 0 ? 'no fixer changes anything' : `${String(count)} ${noun} would change`;
        return `${fixes.diffs.join('\n')}\n${verdict}\n\n${text}`;
    }
    if (count === 0) {
        note('no fixer changed anything');
        return text;
    }
    const shown = codeList(fixes.changed);
    warn(`fixers changed ${String(count)} ${noun}; the changes are in the working tree and are not staged: ${shown}`);
    return text;
}

// Warns when the configured hooks are not installed in the clone the report is published to.
function warnAboutHooks(session: ToolSession, revision: RevisionSource | undefined): void {
    if (revision?.content === 'commit') return;
    const hooks = hookStatus({
        policy: session.policyFiles.policy,
        repository: {
            root: revision?.reportRoot ?? session.root,
            hasGit: revision?.reportRoot !== undefined || session.repository.hasGit,
        },
    });
    if (!hooks.ready) warn(`Configured hooks are not ready in this clone. ${hooks.text}`);
}

// The changed set a run compares against: the revision's paths, the --changed ref, or nothing for a whole push.
async function changedSet(
    session: ToolSession,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<ChangedPaths | undefined> {
    if (revision?.content === 'commit' && session.policyFiles.policy.hooks?.push_files === 'all') return undefined;
    if (revision?.changed !== undefined) return { reference: revision.reference, paths: revision.changed };
    return options.changed === undefined ? undefined : getChanged(session.root, options.changed, signal);
}

// The staged set a run narrows to: the revision's, the index when asked, or nothing.
async function stagedSet(
    session: ToolSession,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<Selections['staging']> {
    if (revision?.staged !== undefined) return revision.staged;
    return options.staged ? getStaged(session.root, signal) : { staged: undefined, unstaged: 0 };
}

// A pushed commit is reproduced through the push options, not through the copy the check ran in.
function rewriteReproductions(checks: RunReport['checks'], options: CheckOptions): void {
    for (const check of checks)
        if (check.reproduce !== undefined) check.reproduce = reproduceLine(check.check, check.scope, options);
}

function buildResult(options: CheckOptions, outcome: Awaited<ReturnType<typeof executeRun>>): CheckCommandResult {
    const reportText = runText(outcome.report, options.verbosity, options.hook);
    const text = outcome.fixes ? reportFixes(outcome.fixes, options.isDryRun, reportText) : reportText;
    return { text, json: outcome.report, report: outcome.report, exitCode: outcome.report.exitCode };
}

// What the run narrows to: the changed set, the staged set, and the stage.
async function selectionsFor(
    session: ToolSession,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<Selections> {
    const changed = await changedSet(session, options, signal, revision);
    const staging = await stagedSet(session, options, signal, revision);
    const stage: StageFilter = options.stage ?? 'all';
    const paths = selectedPaths(session, options, [...(staging.staged ?? []), ...(changed?.paths ?? [])]);
    return { changed, staging, stage, paths: paths.length === 0 ? undefined : paths };
}

// Runs the selected checks and formats their results.
async function runSelected(
    session: ToolSession,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
    selections: Selections,
): Promise<CheckCommandResult> {
    const { changed, staging, stage, paths } = selections;
    let comparison: RunOptions['comparison'];
    if (revision !== undefined) comparison = { content: revision.content, reference: revision.reference };
    else if (changed !== undefined) comparison = { content: 'working-tree', reference: changed.reference };
    const outcome = await executeRun(session, {
        checks: BUILT_IN_CHECKS,
        ...compact({
            stage,
            skips: options.skips,
            fix: options.fix,
            isDryRun: options.isDryRun,
            onResult: options.onResult,
            staged: staging.staged,
            changed: changed?.paths,
            comparison,
            only: options.only,
            paths,
            messageFile: options.messageFile,
            // A --changed run checks the commit messages and history after the merge base, not the whole history.
            commits: revision === undefined ? changed?.commits : revision.commits,
            historyComplete: revision?.historyComplete,
        }),
        unstagedChanges: staging.unstaged,
        cancelSignal: signal,
    });
    if (options.push !== undefined) rewriteReproductions(outcome.report.checks, options);
    return buildResult(options, outcome);
}

/**
 * Runs check and returns what to print.
 * @param root the tree to check: the repository, or a copy of a revision.
 * @param options the parsed flags.
 * @param signal cancellation for the run.
 * @param revision what the copy stands for, when the root is one.
 * @returns the text, the run report, and the exit code.
 */
export async function checkTree(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision?: RevisionSource,
): Promise<CheckCommandResult> {
    assertVersionPin(root);
    const session = await openSession(root);
    try {
        const stale = reconcileConfigurations(session).notes;
        if (stale.length > 0) warn(`The saved setup is stale: ${stale.join('; ')}. Run: gspot apply`);
    } catch (error) {
        warn(`Setup detection could not finish: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (revision !== undefined) {
        session.installedRoot = revision.installedRoot;
    }
    refuseUnknownChecks(session, options.only);
    warnAboutHooks(session, revision);
    const selections = await selectionsFor(session, options, signal, revision);
    return runSelected(session, options, signal, revision, selections);
}
