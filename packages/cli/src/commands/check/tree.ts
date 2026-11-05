import { formatFixes, formatRunReport, printFailedFixers } from '#cli/commands/check/report.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { findSettingsSkip } from '#cli/engine/skips.ts';
import { CHECK_GENERATION } from '#cli/generation/checks.ts';
import { assertCheckExists, listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { readChangedPaths } from '#cli/repository/revisions/changes.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/system/paths.ts';
import { printWarning } from '#cli/system/terminal.ts';
import { readHookStatus } from '#cli/tools/installers/hooks.ts';
import type { CheckOptions, RevisionSource } from '#cli/types/commands/reports.ts';
import type { RunSelection } from '#cli/types/engine/plan.ts';
import type { FixReport, RunOptions, RunReport } from '#cli/types/engine/run.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

function listMatchingFiles(session: Session, cwd: string, path: string, files: string[]): string[] {
    const selector = buildArgumentPath(session.toolsRoot, cwd, path);
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

function buildRunOptions(
    session: Session,
    options: CheckOptions,
    run: { selection: RunSelection; started: Date | undefined },
): RunOptions {
    const { selection, started } = run;
    const paths = selectArgumentPaths(session, options, selection.paths ?? []);
    return {
        selectCheckCode,
        generation: CHECK_GENERATION,
        cwd: options.cwd,
        pathArguments: options.paths,
        stage: options.stage ?? 'all',
        fix: options.fix,
        verbose: options.verbose,
        onProgress: options.onProgress,
        only: options.only,
        skip: options.skip,
        paths: paths.length === 0 ? undefined : paths,
        selection,
        started,
    };
}

function formatLevelNote(id: string, report: RunReport, session: Session): string {
    const { level } = session.settings;
    return report.checks.some(({ check, status }) => check === id && (status === 'missing' || status === 'error'))
        ? `${id} is off at level ${level}, so gspot install leaves out its files. To run it, run gspot set level all.`
        : `${id}: --only allows this check to run here; it stays off in hooks at level ${level}.`;
}

function assertNamedChecks(session: Session, options: Pick<CheckOptions, 'only' | 'skip'>): string[] {
    const selected = session.scopes.flatMap((scope) =>
        scope.configurations.flatMap((configuration) => configuration.checks.map((check) => ({ check, scope }))),
    );
    const shipped = listChecksById(readConfigurations().values());
    const settings = session.settings;
    const commandChecks = Object.values(settings.commandChecks);
    const { skip = [], only = [] } = options;
    for (const id of skip) assertCheckExists(id, commandChecks);
    return only.flatMap((id) => {
        assertCheckExists(id, commandChecks);
        const match = selected.find(({ check }) => check.id === id);
        if (match !== undefined)
            return findSettingsSkip(settings, match.scope, match.check)?.cause === 'level' ? [id] : [];
        const owner = shipped.get(id);
        if (owner === undefined) return [];
        throw new GspotError(
            'arguments',
            `${id} belongs to ${owner.configuration.name}, which no scope selects. Run gspot add ${owner.configuration.name}.`,
        );
    });
}

async function warnMissingHooks(session: Session, revision: RevisionSource | undefined): Promise<void> {
    if (revision?.selection.content === 'commit') return;
    const hooks = await readHookStatus(session, { root: session.toolsRoot });
    if (hooks.ready) return;
    const lines = hooks.lines ?? ['The Git hooks are not installed in this clone. Run gspot install.'];
    for (const line of lines) printWarning(line);
}

async function readSelection(
    session: Session,
    options: CheckOptions,
    cancelSignal: AbortSignal,
): Promise<{ selection: RunSelection; note?: string }> {
    if (options.messageFile !== undefined)
        return { selection: { content: 'message', messageFile: options.messageFile } };
    if (options.base === undefined) return { selection: { content: 'working-tree' } };
    const changed = await readChangedPaths(session.root, options.base, cancelSignal);
    const note = changed.note === undefined ? {} : { note: changed.note };
    if (changed.paths === undefined) return { selection: { content: 'working-tree' }, ...note };
    const { reference, paths, commits } = changed;
    return { selection: { content: 'working-tree', reference, base: reference, paths, commits }, ...note };
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
    const started = revision?.selection.content === 'index' ? revision.started : new Date();
    try {
        const session = await openSession(treeFolder, {
            toolsRoot: treeFolder,
            ...revision,
            toolCache: options.toolCache,
            settings: options.settings,
            listing: options.listing,
            resources,
            cancelSignal,
        });
        const onlyNotes = assertNamedChecks(session, options);
        const { selection, note } =
            revision === undefined
                ? await readSelection(session, options, cancelSignal)
                : { selection: revision.selection, note: revision.dependencyNote };
        await warnMissingHooks(session, revision);
        const result = await runChecks(session, buildRunOptions(session, options, { selection, started }));
        if (result.fixes !== undefined) printFailedFixers(result.fixes, { verbose: options.verbose });
        if (note !== undefined) result.report.notes.push(note);
        result.report.notes.push(...onlyNotes.map((id) => formatLevelNote(id, result.report, session)));
        const reportText = formatRunReport(result.report, { verbose: options.verbose, canceled: cancelSignal.aborted });
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
