import { GspotError } from '#cli/system/errors.ts';
import { getColors } from '#cli/system/terminal.ts';
import { type Session } from '#cli/types/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { readHookStatus } from '#cli/installers/hooks.ts';
import { findSettingsSkip } from '#cli/planning/skips.ts';
import { type StageFilter } from '#cli/types/planning.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { type ChangedPaths } from '#cli/types/repository/revisions.ts';
import { readChangedPaths } from '#cli/repository/revisions/changes.ts';
import { isInScope, buildArgumentPath } from '#cli/repository/scopes.ts';
import { listChecksById, assertCheckExists } from '#cli/manifests/read.ts';
import { EMPTY_BASE, CREATED_BRANCH_BASE } from '#cli/config/commands/check.ts';
import { formatFixes, formatRunReport, printFailedFixers } from '#cli/commands/check/report.ts';

import {
    type FixReport,
    type RunReport,
    type RunOptions,
    type RunFilters,
    type CheckOptions,
    type RevisionSource,
} from '#cli/types/commands/check.ts';

function buildHistorySelection(
    revision: RevisionSource | undefined,
    changed: RunFilters['changed'],
): Pick<RunOptions, 'commits' | 'base' | 'shallow' | 'range'> {
    if (revision?.content === 'commit')
        return {
            commits: revision.commits,
            range: revision.range,
            base: revision.base ?? changed?.reference,
            shallow: revision.shallow,
        };
    return { commits: changed?.commits, base: changed?.reference };
}

function buildRunOptions(options: CheckOptions, filters: RunFilters, revision: RevisionSource | undefined): RunOptions {
    const { changed, staging, stage, paths } = filters;
    const comparison = buildComparison(revision, changed);
    return {
        cwd: revision?.content === 'index' ? revision.cwd : options.cwd,
        pathArguments: revision?.content === 'index' ? revision.paths : options.paths,
        started: revision?.content === 'index' ? revision.started : undefined,
        stage,
        fix: options.fix,
        verbose: options.verbose,
        onProgress: options.onProgress,
        staged: staging.staged,
        changed: changed?.paths,
        comparison,
        only: options.only,
        paths,
        messageFile: options.messageFile,
        push: options.push,
        ...buildHistorySelection(revision, changed),
        unstagedChanges: staging.unstaged,
    };
}

function buildComparison(
    revision: RevisionSource | undefined,
    changed: RunFilters['changed'],
): RunOptions['comparison'] {
    if (revision !== undefined) return { content: revision.content, reference: revision.reference };
    return changed === undefined ? undefined : { content: 'working-tree', reference: changed.reference };
}

function listMatchingFiles(session: Session, cwd: string, path: string, files: string[]): string[] {
    const selector = buildArgumentPath(session.root, cwd, path);
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
    const shipped = listChecksById(session.configurationsByName.values());
    const settings = session.settings;
    const requested = only ?? [];
    for (const id of requested) {
        assertCheckExists(id, settings);
        const match = selected.find(({ check }) => check.id === id);
        if (match === undefined) {
            const owner = shipped.get(id);
            if (owner !== undefined)
                throw new GspotError(
                    'arguments',
                    `${id} belongs to ${owner.configuration.name}, which no scope selects. Run gspot add ${owner.configuration.name}.`,
                );
        } else if (findSettingsSkip(settings, match.scope, match.check)?.cause === 'level')
            throw new GspotError('arguments', `${id} is off at level basic. Run gspot set level all to turn it on.`);
    }
}

async function warnMissingHooks(session: Session, revision: RevisionSource | undefined): Promise<void> {
    if (revision?.content === 'commit') return;
    const hooks = await readHookStatus(session, {
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

function formatAllFilesHeader(options: CheckOptions, revision: RevisionSource | undefined): string {
    if (revision !== undefined || options.allFiles === undefined) return '';
    const cause = options.allFiles === 'empty-base' ? EMPTY_BASE : CREATED_BRANCH_BASE;
    return `Checked every file: ${cause}.\n`;
}

function addRevisionPaths(session: Session, revision: RevisionSource | undefined): void {
    const paths = revision?.unreadablePaths;
    if (paths === undefined) return;
    session.repository.unreadablePaths.push(...paths);
}

function addRevisionNotes(report: RunReport, revision: RevisionSource | undefined): void {
    const note = revision?.dependencyNote;
    if (note === undefined) return;
    report.notes.push(note);
}

/**
Check the files of one working tree: the repository, or a copy of the staged index or of a pushed commit.

@param treeFolder the working tree or the copy to check.
@param options the parsed flags.
@param cancelSignal stops the run.
@param revision the commit or index that the copy holds, if any.
*/
export async function runTreeCheck(
    treeFolder: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision?: RevisionSource,
): Promise<CommandResult<RunReport & { fixes?: FixReport | undefined }>> {
    using resources = new DisposableStack();
    const session = await openSession(treeFolder, {
        toolsRoot: revision?.toolsRoot ?? treeFolder,
        resources,
        cancelSignal,
    });
    addRevisionPaths(session, revision);
    assertOnlyChecks(session, options.only);
    const filters = await readRunFilters(session, options, cancelSignal, revision);
    await warnMissingHooks(session, revision);
    const result = await runChecks(session, buildRunOptions(options, filters, revision));
    if (result.fixes !== undefined) printFailedFixers(result.fixes, { verbose: options.verbose });
    addRevisionNotes(result.report, revision);
    const reportText =
        formatAllFilesHeader(options, revision) +
        formatRunReport(result.report, { verbose: options.verbose, selectedOnly: options.only !== undefined });
    const text = result.fixes ? `${formatFixes(result.fixes).join('\n')}\n${reportText}` : reportText;
    return {
        text,
        json: { ...result.report, fixes: result.fixes },
        exitCode: result.report.exitCode,
    };
}
