import { openSession } from '#cli/session.ts';
import { resolve, relative } from 'node:path';
import { warn } from '#cli/system/terminal.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readHookStatus } from '#cli/apply/hooks.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { listHookNames } from '#cli/generation/hooks.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { Session, StageFilter } from '#cli/types/planning.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { formatUnknownCheck } from '#cli/configurations/manifests.ts';
import { type ChangedPaths } from '#cli/types/repository/revisions.ts';
import { fixLines, formatRunReport } from '#cli/commands/check/report.ts';
import type { RunReport, RunOptions } from '#cli/types/checks/run/check.ts';
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

// List the files that a path names: the file itself, or every file in a folder.
function listMatchingFiles(session: Session, options: CheckOptions, path: string, candidates: string[]): string[] {
    const selector = convertToPosixPath(relative(session.root, resolve(options.cwd, path)));
    if (!isInside(selector)) throw new GspotError('arguments', `Path ${path} is outside this repository.`);
    const matches = candidates.filter((file) => isInScope(file, selector));
    if (matches.length === 0) throw new GspotError('arguments', `Path ${path} matches no repository files.`);
    return matches;
}

/**
 * Select the files that the path arguments name.
 * @param session the repository files.
 * @param options the parsed flags.
 * @param changed the staged or modified paths, which can name deleted files.
 * @returns the matching paths, or none without path arguments.
 */
function selectArgumentPaths(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const candidates = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set(options.paths.flatMap((path) => listMatchingFiles(session, options, path, candidates)));
    return [...selected];
}

/**
 * Refuse an --only check that no configuration here runs.
 * @param session the configurations that run here.
 * @param only the check IDs that the flag names.
 */
function refuseUnknownChecks(session: Session, only: string[] | undefined): void {
    const known = new Set([
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...Object.values(session.settingsFile.settings.commandChecks).map((check) => check.name),
    ]);
    const unknown = only?.find((check) => !known.has(check));
    if (unknown !== undefined) throw new GspotError('arguments', formatUnknownCheck(unknown, [...known]));
}

// Warns when the clone receiving the report lacks the configured hooks.
function warnAboutHooks(session: Session, revision: RevisionSource | undefined): void {
    if (revision?.content === 'commit') return;
    const hooks = readHookStatus({
        runner: session.startRunner,
        settings: session.settingsFile.settings,
        hooks: listHookNames(session.configuredChecks),
        repository: {
            root: revision?.reportRoot ?? session.root,
            hasGit: revision?.reportRoot !== undefined || session.repository.hasGit,
        },
    });
    if (!hooks.ready) warn('The Git hooks are not installed in this clone. Run: gspot install');
}

// Read the changed paths: from the revision, from the --changed ref, or none for a whole push.
async function readChangedSet(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<ChangedPaths | undefined> {
    if (revision?.changed !== undefined) return { reference: revision.reference, paths: revision.changed };
    return options.base === undefined ? undefined : readChangedPaths(session.root, options.base, signal);
}

// Read the staged paths: from the revision, from the index for --staged, or none.
async function readStagedSet(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<RunFilters['staging']> {
    if (revision?.staged !== undefined) return revision.staged;
    return options.staged ? readStagedPaths(session.root, signal) : { staged: undefined, unstaged: 0 };
}

// Collect the run filters: the changed paths, the staged paths, and the stage.
async function runFilters(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<RunFilters> {
    const changed = await readChangedSet(session, options, signal, revision);
    const staging = await readStagedSet(session, options, signal, revision);
    const stage: StageFilter = options.stage ?? 'all';
    const paths = selectArgumentPaths(session, options, [...(staging.staged ?? []), ...(changed?.paths ?? [])]);
    return { changed, staging, stage, paths: paths.length === 0 ? undefined : paths };
}

/**
 * Run check and return what to print.
 * @param treeFolder the working tree or scratch copy to check.
 * @param options the parsed flags.
 * @param signal stops the run.
 * @param revision the commit or index that the copy holds, if any.
 * @returns the command result.
 */
export async function checkTree(
    treeFolder: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision?: RevisionSource,
): Promise<CommandResult<RunReport>> {
    const session = await openSession(treeFolder, undefined, { installedRoot: revision?.installedRoot ?? treeFolder });
    refuseUnknownChecks(session, options.only);
    warnAboutHooks(session, revision);
    const { changed, staging, stage, paths } = await runFilters(session, options, signal, revision);
    const result = await runChecks(
        session,
        buildRunOptions(options, { changed, staging, stage, paths }, signal, revision),
    );
    const reportText = formatRunReport(result.report, {
        verbose: options.verbose,
        ...stripUndefined({ hook: options.hook }),
    });
    const text = result.fixes
        ? `${fixLines(result.fixes, { isDryRun: options.isDryRun, verbose: options.verbose }).join('\n')}\n${reportText}`
        : reportText;
    return {
        text: options.isDryRun ? `${text}Dry run: nothing was written.\n` : text,
        json: { ...result.report, ...stripUndefined({ fixes: result.fixes }) },
        exitCode: result.report.exitCode,
    };
}
