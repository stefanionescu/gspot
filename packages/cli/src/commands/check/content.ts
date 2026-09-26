// Checking one tree: the working tree, or a snapshot of the index or of a pushed commit.
import { runText } from '#cli/output/reporter.ts';
import { writeReport } from '#cli/output/report.ts';
import { note, warn } from '#cli/output/messages.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { hookStatus } from '#cli/lifecycle/hooks/status.ts';
import { reproduceLine } from '#cli/execution/reproduce.ts';
import { CHANGED_SHOWN } from '#cli/constants/commands/check.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { stagedFiles } from '#cli/repository/revisions/selection.ts';
import type { ChangedSet, StagedSet } from '#cli/types/repository/revisions.ts';
import type { Revision, Selections, CheckCommandResult, CheckOptions } from '#cli/types/commands/check.ts';
import type { FixReport, RunOptions, RunReport, Session, StageFilter } from '#cli/types/execution/execution.ts';
import { refusalFor, revisionSelection, selectedPaths, unknownSelection } from '#cli/commands/check/selection.ts';

function runOptions(
    options: CheckOptions,
    stage: StageFilter,
    staged: string[] | undefined,
    changed: ChangedSet | undefined,
): RunOptions {
    return {
        stage,
        skips: options.skips,
        fix: options.fix,
        isDryRun: options.isDryRun,
        noCache: options.noCache,
        ...(options.onResult === undefined ? {} : { onResult: options.onResult }),
        ...(staged === undefined ? {} : { staged }),
        ...(changed === undefined
            ? {}
            : {
                  changed: changed.paths,
                  comparison: { content: 'working-tree' as const, reference: changed.reference },
              }),
        ...(options.only === undefined ? {} : { only: options.only }),
        ...(options.paths.length === 0 ? {} : { paths: options.paths }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
}

function fixSummary(fixes: FixReport, isDryRun: boolean, text: string): string {
    const failures = fixes.results.filter((result) => result.status === 'failed');
    for (const result of failures) warn(`a fixer failed: ${result.check}: ${result.note}`);
    const count = fixes.changed.length;
    if (isDryRun) {
        const verdict = count === 0 ? 'no fixer changes anything' : `${String(count)} file(s) would change`;
        return `${fixes.diffs.join('\n')}\n${verdict}\n\n${text}`;
    }
    if (count === 0) note('no fixer changed anything');
    else {
        const shown = fixes.changed.slice(0, CHANGED_SHOWN).join(' ');
        const more = count > CHANGED_SHOWN ? ' ...' : '';
        warn(
            `fixers changed ${String(count)} file(s); the changes are in the working tree and are not staged: ${shown}${more}`,
        );
    }
    return text;
}

// Warns when the configured hooks are not installed in the clone the report is published to.
function warnAboutHooks(session: Session, root: string, revision: Revision | undefined): void {
    if (revision?.content === 'commit') return;
    const hooks = hookStatus({
        policy: session.policyFiles.policy,
        repository: {
            root: revision?.reportRoot ?? root,
            hasGit: revision?.reportRoot !== undefined || session.repository.hasGit,
        },
    });
    if (!hooks.ready) warn(`Configured hooks are not ready in this clone. ${hooks.text}`);
}

// The changed set a run compares against: the revision's paths, the --changed ref, or nothing for a whole push.
async function changedSet(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: Revision | undefined,
): Promise<ChangedSet | undefined> {
    if (revision?.content === 'commit' && session.policyFiles.policy.hooks?.push === 'all') return undefined;
    if (revision?.changed !== undefined) return { reference: revision.reference, paths: revision.changed };
    return revisionSelection(session, options, signal);
}

// The staged set a run narrows to: the revision's, the index when asked, or nothing.
async function stagedSet(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision: Revision | undefined,
): Promise<StagedSet | { staged: undefined; unstaged: number }> {
    if (revision?.staged !== undefined) return revision.staged;
    return options.staged ? stagedFiles(root, signal) : { staged: undefined, unstaged: 0 };
}

// A pushed commit is reproduced through the push options, not through the snapshot the check ran in.
function rewriteReproductions(checks: RunReport['checks'], options: CheckOptions): void {
    for (const check of checks)
        if (check.reproduce !== undefined) check.reproduce = reproduceLine(check.check, check.scope, options);
}

// The run options a revision adds: what the report compares against and the commits under review.
function revisionOptions(revision: Revision | undefined): Partial<RunOptions> {
    if (revision === undefined) return {};
    return {
        comparison: { content: revision.content, reference: revision.reference },
        ...(revision.commits === undefined ? {} : { commits: revision.commits }),
        ...(revision.historyComplete === undefined ? {} : { historyComplete: revision.historyComplete }),
    };
}

function resultFor(
    options: CheckOptions,
    outcome: Awaited<ReturnType<typeof executeRun>>,
    unstaged: number,
    reportRoot?: string,
): CheckCommandResult {
    outcome.report.unstaged = unstaged;
    if (reportRoot !== undefined && !options.isDryRun && options.stage !== 'message')
        writeReport(reportRoot, outcome.report);
    const rendered = runText(outcome.report, { quiet: options.quiet, verbose: options.verbose });
    const text = outcome.fixes ? fixSummary(outcome.fixes, options.isDryRun, rendered) : rendered;
    return { text, json: outcome.report, report: outcome.report, exitCode: outcome.report.exitCode };
}

// What the run narrows to: the changed set, the staged set, and the stage.
async function selectionsFor(
    session: Session,
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision: Revision | undefined,
): Promise<Selections> {
    const changed = await changedSet(session, options, signal, revision);
    const set = await stagedSet(root, options, signal, revision);
    const stage: StageFilter = options.stage ?? (options.staged ? 'commit' : 'all');
    return { changed, set, stage };
}

// Runs the checks over the selections and renders the outcome.
async function runSelected(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: Revision | undefined,
    selections: Selections,
): Promise<CheckCommandResult> {
    const { changed, set, stage } = selections;
    const paths = selectedPaths(session, options, [...(set.staged ?? []), ...(changed?.paths ?? [])]);
    const outcome = await executeRun(session, {
        ...runOptions({ ...options, paths }, stage, set.staged, changed),
        ...revisionOptions(revision),
        cancelSignal: signal,
    });
    if (options.push !== undefined) rewriteReproductions(outcome.report.checks, options);
    return resultFor(options, outcome, set.unstaged, revision?.reportRoot);
}

/**
 * Runs check and returns what to print.
 * @param root the tree to check: the repository, or a snapshot of a revision
 * @param options the parsed flags
 * @param signal cancellation for the run
 * @param revision what the snapshot stands for, when the root is one
 * @returns the text, the run report and the exit code
 */
export async function checkContent(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision?: Revision,
): Promise<CheckCommandResult> {
    assertPinMatches(root);
    const session = await openSession(root);
    if (revision !== undefined) session.cacheRoot = revision.cacheRoot;
    const unknown = unknownSelection(session, options.only);
    if (unknown !== undefined) return unknown;
    warnAboutHooks(session, root, revision);
    const selections = await selectionsFor(session, root, options, signal, revision);
    const refusal = refusalFor(options, selections.stage, selections.set.staged);
    if (refusal) return refusal;
    return runSelected(session, options, signal, revision, selections);
}
