// Selects positional repository paths and refuses unknown check IDs.
// Checking one tree: the working tree, or a copy of the index or of a pushed commit.
// Selects positional repository paths and refuses unknown check IDs.
// Checking one tree: the working tree, or a copy of the index or of a pushed commit.
import { resolve, relative } from 'node:path';
import { executeRun } from '#cli/execution/run.ts';
import { hookStatus } from '#cli/install/hooks.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { formatCodeList } from '#cli/system/text.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openSession } from '#cli/commands/session.ts';
import { warn, colors } from '#cli/system/terminal.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { runText } from '#cli/commands/check/report.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';
import type { Session, StageFilter } from '#cli/types/planning.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { formatUnknownCheck } from '#cli/configurations/manifests.ts';
import { type ChangedPaths } from '#cli/types/repository/revisions.ts';
import type { RunReport, FixReport, RunOptions } from '#cli/types/execution/check.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';
import type { RunFilters, CheckOptions, RevisionSource } from '#cli/types/commands/check.ts';

function buildRunOptions(
    options: CheckOptions,
    filters: RunFilters,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): RunOptions {
    const { changed, staging, stage, paths } = filters;
    const changedPaths = changed?.paths;
    const changedCommits = changed?.commits;
    const comparison = buildComparison(revision, changed);
    return {
        checks: BUILT_IN_CHECKS,
        ...stripUndefined({
            stage,
            fix: options.fix,
            isDryRun: options.isDryRun,
            onResult: options.onResult,
            staged: staging.staged,
            changed: changedPaths,
            comparison,
            only: options.only,
            paths,
            messageFile: options.messageFile,
            push: options.push,
            // A --changed run checks the commit messages and history after the merge base, not the whole history.
            commits: revision === undefined ? changedCommits : revision.commits,
            base: revision?.base ?? changed?.reference,
            historyComplete: revision?.historyComplete,
        }),
        unstagedChanges: staging.unstaged,
        cancelSignal: signal,
    };
}

function buildComparison(
    revision: RevisionSource | undefined,
    changed: RunFilters['changed'],
): RunOptions['comparison'] {
    if (revision !== undefined) return { content: revision.content, reference: revision.reference };
    if (changed !== undefined) return { content: 'working-tree', reference: changed.reference };
    return undefined;
}

// The repository files a selector names: the file itself, or everything under a folder.
function matchingFiles(session: Session, options: CheckOptions, path: string, candidates: string[]): string[] {
    const selector = convertToPosixPath(relative(session.root, resolve(options.cwd, path)));
    if (!isInside(selector)) throw new GspotError('arguments', `Path ${path} is outside this repository.`);
    const matches = candidates.filter((file) => isInScope(file, selector));
    if (matches.length === 0) throw new GspotError('arguments', `Path ${path} matches no repository files.`);
    return matches;
}

/**
 * Selects tracked and changed repository files through positional paths.
 * @param session the open session
 * @param options the parsed flags
 * @param changed the staged or changed paths, which can name deleted files
 * @returns the selected paths, or none when the caller gave no path
 */
function pathArguments(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const candidates = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set(options.paths.flatMap((path) => matchingFiles(session, options, path, candidates)));
    return [...selected];
}

/**
 * Refuses an --only check no selected configuration runs here.
 * @param session the open session
 * @param only the checks named on the command line
 */
function refuseUnknownChecks(session: Session, only: string[] | undefined): void {
    const known = new Set([
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...Object.values(session.settingsFile.settings.check).map((check) => check.name),
    ]);
    const unknown = only?.find((check) => !known.has(check));
    if (unknown !== undefined) throw new GspotError('arguments', formatUnknownCheck(unknown, [...known]));
}

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
        process.stderr.write(`${colors.cyan('[info]')} no fixer changed anything\n`);
        return text;
    }
    const shown = formatCodeList(fixes.changed);
    warn(`fixers changed ${String(count)} ${noun}; the changes are in the working tree and are not staged: ${shown}`);
    return text;
}

// Warns when the clone receiving the report lacks the configured hooks.
function warnAboutHooks(session: Session, revision: RevisionSource | undefined): void {
    if (revision?.content === 'commit') return;
    const hooks = hookStatus({
        runner: session.startRunner,
        settings: session.settingsFile.settings,
        repository: {
            root: revision?.reportRoot ?? session.root,
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
    revision: RevisionSource | undefined,
): Promise<ChangedPaths | undefined> {
    if (revision?.changed !== undefined) return { reference: revision.reference, paths: revision.changed };
    return options.base === undefined ? undefined : readChangedPaths(session.root, options.base, signal);
}

// The staged set a run narrows to: the revision's, the index when asked, or nothing.
async function stagedSet(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<RunFilters['staging']> {
    if (revision?.staged !== undefined) return revision.staged;
    return options.staged ? readStagedPaths(session.root, signal) : { staged: undefined, unstaged: 0 };
}

// What the run narrows to: the changed set, the staged set, and the stage.
async function runFilters(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<RunFilters> {
    const changed = await changedSet(session, options, signal, revision);
    const staging = await stagedSet(session, options, signal, revision);
    const stage: StageFilter = options.stage ?? 'all';
    const paths = pathArguments(session, options, [...(staging.staged ?? []), ...(changed?.paths ?? [])]);
    return { changed, staging, stage, paths: paths.length === 0 ? undefined : paths };
}

// Runs the selected checks and formats their results.
async function runSelected(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
    selections: RunFilters,
): Promise<CommandResult<RunReport>> {
    const outcome = await executeRun(session, buildRunOptions(options, selections, signal, revision));
    const reportText = runText(outcome.report, options.verbose, options.hook);
    const text = outcome.fixes ? reportFixes(outcome.fixes, options.isDryRun, reportText) : reportText;
    return {
        text: options.isDryRun ? `${text}Dry run: nothing was written.\n` : text,
        json: { ...outcome.report, ...stripUndefined({ fixes: outcome.fixes }) },
        exitCode: outcome.report.exitCode,
    };
}

/**
 * Runs check and returns what to print.
 * @param root the tree to check: the repository, or a copy of a revision.
 * @param options the parsed flags.
 * @param signal cancellation for the run.
 * @param revision what the copy stands for, when the root contains a copy.
 * @returns the text, the run report, and the exit code.
 */
export async function checkTree(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision?: RevisionSource,
): Promise<CommandResult<RunReport>> {
    await assertVersionPin(root);
    const settingsFile = readSettings(root);
    const session = await openSession(root, settingsFile, { installedRoot: revision?.installedRoot ?? root });
    refuseUnknownChecks(session, options.only);
    warnAboutHooks(session, revision);
    const selections = await runFilters(session, options, signal, revision);
    return runSelected(session, options, signal, revision, selections);
}
