import { openSession } from '#cli/session.ts';
import { resolve, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { getColors } from '#cli/system/terminal.ts';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { readHookStatus } from '#cli/install/hooks.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import { findSettingsSkip } from '#cli/planning/skips.ts';
import type { StageFilter } from '#cli/types/planning.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { DRY_RUN_NOTE } from '#cli/config/commands/apply.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import type { RunReport, RunOptions } from '#cli/types/runs/run.ts';
import type { ChangedPaths } from '#cli/types/repository/revisions.ts';
import { readChangedPaths } from '#cli/repository/revisions/changes.ts';
import type { RunFilters, CheckOptions, RevisionSource } from '#cli/types/commands/check.ts';
import { formatFixes, formatRunReport, printFailedFixers } from '#cli/commands/check/report.ts';

function buildHistorySelection(
    revision: RevisionSource | undefined,
    changed: RunFilters['changed'],
): Pick<RunOptions, 'commits' | 'base' | 'historyComplete'> {
    let commits = changed?.commits;
    let base = changed?.reference;
    let historyComplete: RunOptions['historyComplete'];
    if (revision?.content === 'commit') {
        commits = revision.commits;
        base = revision.base ?? base;
        historyComplete = revision.historyComplete;
    } else if (revision !== undefined) commits = undefined;
    return stripUndefined({ commits, base, historyComplete });
}

function buildRunOptions(options: CheckOptions, filters: RunFilters, revision: RevisionSource | undefined): RunOptions {
    const { changed, staging, stage, paths } = filters;
    const changedPaths = changed?.paths;
    const comparison = buildComparison(revision, changed);
    return {
        cwd: revision?.content === 'index' ? revision.cwd : options.cwd,
        pathArguments: revision?.content === 'index' ? revision.paths : options.paths,
        ...stripUndefined({
            stage,
            fix: options.fix,
            isDryRun: options.isDryRun,
            onProgress: options.onProgress,
            staged: staging.staged,
            changed: changedPaths,
            comparison,
            only: options.only,
            paths,
            messageFile: options.messageFile,
            push: options.push,
            ...buildHistorySelection(revision, changed),
        }),
        unstagedChanges: staging.unstaged,
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

function listMatchingFiles(session: Session, cwd: string, path: string, files: string[]): string[] {
    const selector = convertToPosixPath(relative(session.root, resolve(cwd, path)));
    if (!isInside(selector)) throw new GspotError('arguments', `Path ${path} is outside this repository.`);
    const matches = files.filter((file) => isInScope(file, selector));
    if (matches.length === 0) throw new GspotError('arguments', `Path ${path} matches no repository files.`);
    return matches;
}

function selectArgumentPaths(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const repositoryPaths = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set(
        options.paths.flatMap((path) => listMatchingFiles(session, options.cwd, path, repositoryPaths)),
    );
    return [...selected];
}

function assertOnlyChecks(session: Session, only: string[] | undefined): void {
    const selected = session.scopes.flatMap((scope) =>
        scope.configurations.flatMap((configuration) => configuration.checks.map((check) => ({ check, scope }))),
    );
    const checkIds = new Set([
        ...selected.map(({ check }) => check.id),
        ...Object.values(session.settingsFile.settings.commandChecks).map((check) => check.id),
    ]);
    const unknown = only?.find((check) => !checkIds.has(check));
    if (unknown !== undefined)
        throw new GspotError(
            'arguments',
            `There is no check called ${unknown}.${formatSimilarNames(unknown, [...checkIds])}`,
        );
    for (const id of only ?? []) {
        const match = selected.find(({ check }) => check.id === id);
        if (
            match !== undefined &&
            findSettingsSkip(session.settingsFile.settings, match.scope, match.check)?.cause === 'level'
        )
            throw new GspotError(
                'arguments',
                `${id} is off at level recommended. Run gspot set level all to turn it on.`,
            );
    }
}

function warnAboutHooks(session: Session, revision: RevisionSource | undefined): void {
    if (revision?.content === 'commit') return;
    const hooks = readHookStatus(session, {
        root: revision?.reportRoot ?? session.root,
        hasGit: revision?.reportRoot !== undefined || session.repository.hasGit,
    });
    if (!hooks.ready)
        process.stderr.write(
            `${getColors().yellow('[warn]')} The Git hooks are not installed in this clone. Run gspot install.\n`,
        );
}

async function readChangedFilter(
    session: Session,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<ChangedPaths | undefined> {
    if (revision?.content === 'commit' && revision.changed !== undefined)
        return { reference: revision.reference, paths: revision.changed };
    return options.base === undefined ? undefined : readChangedPaths(session.root, options.base, cancelSignal);
}

async function readRunFilters(
    session: Session,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<RunFilters> {
    const changed = await readChangedFilter(session, options, cancelSignal, revision);
    const staging = revision?.content === 'index' ? revision.staged : { staged: undefined, unstaged: 0 };
    const stage: StageFilter = options.stage ?? 'all';
    const paths = selectArgumentPaths(session, options, [...(staging.staged ?? []), ...(changed?.paths ?? [])]);
    return { changed, staging, stage, paths: paths.length === 0 ? undefined : paths };
}

/**
 * Check the files of one working tree: the repository, or a copy of the staged index or of a pushed commit.
 *
 * @param treeFolder the working tree or the copy to check.
 * @param options the parsed flags.
 * @param cancelSignal stops the run.
 * @param revision the commit or index that the copy holds, if any.
 * @returns the command result.
 */
export async function checkTree(
    treeFolder: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision?: RevisionSource,
): Promise<CommandResult<RunReport>> {
    using resources = new DisposableStack();
    const session = await openSession(treeFolder, {
        installedRoot: revision?.installedRoot ?? treeFolder,
        resources,
        cancelSignal,
    });
    assertOnlyChecks(session, options.only);
    warnAboutHooks(session, revision);
    const { changed, staging, stage, paths } = await readRunFilters(session, options, cancelSignal, revision);
    const result = await runChecks(session, buildRunOptions(options, { changed, staging, stage, paths }, revision));
    if (result.fixes !== undefined) printFailedFixers(result.fixes, { verbose: options.verbose });
    const reportText = formatRunReport(result.report, { verbose: options.verbose });
    const text = result.fixes
        ? `${formatFixes(result.fixes, { isDryRun: options.isDryRun }).join('\n')}\n${reportText}`
        : reportText;
    return {
        text: options.isDryRun ? `${text}${DRY_RUN_NOTE}\n` : text,
        json: { ...result.report, ...stripUndefined({ fixes: result.fixes }) },
        exitCode: result.report.exitCode,
    };
}
