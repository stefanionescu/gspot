import { runChecks } from '#cli/engine/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { openSession } from '#cli/engine/session.ts';
import { printWarning } from '#cli/system/terminal.ts';
import { findSettingsSkip } from '#cli/engine/skips.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { StageFilter } from '#cli/types/engine/plan.ts';
import type { ChangedPaths } from '#cli/types/repository.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import { readHookStatus } from '#cli/tools/installers/hooks.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readChangedPaths } from '#cli/repository/revisions/changes.ts';
import { isInScope, buildArgumentPath } from '#cli/repository/scopes.ts';
import { listChecksById, assertCheckExists } from '#cli/manifests/read.ts';
import type { FixReport, RunReport, RunOptions } from '#cli/types/engine/run.ts';
import type { RunFilters, CheckOptions, RevisionSource } from '#cli/types/commands/reports.ts';
import { formatFixes, formatRunReport, printFailedFixers } from '#cli/commands/check/report.ts';

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
    return { commits: changed?.commits, base: changed?.paths === undefined ? undefined : changed.reference };
}

function buildRunOptions(options: CheckOptions, filters: RunFilters, revision: RevisionSource | undefined): RunOptions {
    const { changed, staging, stage, paths } = filters;
    const comparison = buildComparison(revision, changed);
    return {
        selectCheckCode,
        generation: {
            buildConfigs,
            listOutdatedFiles: (session, flags) => listOutdatedFiles(session, buildGeneratedFiles(session), flags),
        },
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
    return changed?.paths === undefined ? undefined : { content: 'working-tree', reference: changed.reference };
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

function assertOnlyChecks(session: Session, only: string[] | undefined): string[] {
    const notes: string[] = [];
    const selected = session.scopes.flatMap((scope) =>
        scope.configurations.flatMap((configuration) => configuration.checks.map((check) => ({ check, scope }))),
    );
    const shipped = listChecksById(session.configurationsByName.values());
    const settings = session.settings;
    const requested = only ?? [];
    for (const id of requested) {
        assertCheckExists(id, Object.values(settings.commandChecks));
        const match = selected.find(({ check }) => check.id === id);
        if (match === undefined) {
            const owner = shipped.get(id);
            if (owner !== undefined)
                throw new GspotError(
                    'arguments',
                    `${id} belongs to ${owner.configuration.name}, which no scope selects. Run gspot add ${owner.configuration.name}.`,
                );
        } else if (findSettingsSkip(settings, match.scope, match.check)?.cause === 'level')
            notes.push(`${id}: --only allows this check to run here; it stays off in hooks at level basic.`);
    }
    return notes;
}

async function warnMissingHooks(session: Session, revision: RevisionSource | undefined): Promise<void> {
    if (revision?.content === 'commit') return;
    const hooks = await readHookStatus(session, {
        root: revision?.reportRoot ?? session.root,
    });
    if (!hooks.ready) printWarning('The Git hooks are not installed in this clone. Run gspot install.');
}

async function readChangedFilter(
    session: Session,
    options: CheckOptions,
    cancelSignal: AbortSignal,
    revision: RevisionSource | undefined,
): Promise<ChangedPaths | undefined> {
    if (revision?.content === 'commit' && revision.changed !== undefined)
        return { reference: revision.reference, paths: revision.changed };
    return options.base === undefined && options.changed !== true
        ? undefined
        : readChangedPaths(session.root, options.base, cancelSignal);
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
    const resources: Disposable[] = [];
    try {
        const session = await openSession(treeFolder, {
            toolsRoot: revision?.toolsRoot ?? treeFolder,
            resources,
            cancelSignal,
        });
        addRevisionPaths(session, revision);
        const onlyNotes = assertOnlyChecks(session, options.only);
        const filters = await readRunFilters(session, options, cancelSignal, revision);
        await warnMissingHooks(session, revision);
        const result = await runChecks(session, buildRunOptions(options, filters, revision));
        if (result.fixes !== undefined) printFailedFixers(result.fixes, { verbose: options.verbose });
        addRevisionNotes(result.report, revision);
        result.report.notes.push(...onlyNotes);
        if (filters.changed?.note !== undefined) result.report.notes.push(filters.changed.note);
        const reportText = formatRunReport(result.report, {
            verbose: options.verbose,
            selectedOnly: options.only !== undefined,
        });
        const text = result.fixes ? `${formatFixes(result.fixes).join('\n')}\n${reportText}` : reportText;
        return {
            text,
            json: { ...result.report, fixes: result.fixes },
            exitCode: result.report.exitCode,
        };
    } finally {
        for (const resource of resources.toReversed()) resource[Symbol.dispose]();
    }
}
