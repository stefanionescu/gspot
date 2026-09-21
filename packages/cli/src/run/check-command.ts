import { reproduceLine } from '#cli/run/reproduce.ts';
import type { PushReport } from '#types/report.ts';
import { withRevisionSnapshot } from '#cli/repository/snapshot.ts';
import { writeReport } from '#cli/output/report.ts';
import { readFileSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';
import { note, warn } from '#cli/output/messages.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
// check: open the session, honor the pin, run, render, decide the exit code.
import type { ChangedSet, StagedSet } from '#types/repository.ts';
import { SelectionError } from '#cli/presets/select.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { changedFiles, stagedFiles, pushedRevisions } from '#cli/repository/staged.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#config/env-files.ts';
import type {
    CheckOptions,
    CheckCommandResult,
    CommandResult,
    FixReport,
    RunOptions,
    StageFilter,
    Session,
} from '#types/run.ts';

const CHANGED_SHOWN = 8;

function stagedEnvironmentFiles(staged: string[]): string[] {
    const isEnvironmentFile = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));
    return staged.filter(
        (path) => isEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(path.slice(path.lastIndexOf('/') + 1)),
    );
}

function environmentRefusal(files: string[]): CommandResult {
    return {
        text: `An environment file is staged: ${files.join(', ')}. Unstage it (git restore --staged <file>); only templates like .env.example belong in git.\n`,
        json: { failed: ['integrity/env-files'], files },
        exitCode: 1,
    };
}

function isReadable(path: string): boolean {
    try {
        readFileSync(path, 'utf8');
        return true;
    } catch {
        return false;
    }
}

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

function refusalFor(
    options: CheckOptions,
    stage: StageFilter,
    staged: string[] | undefined,
): CommandResult | undefined {
    const environmentStaged = staged === undefined ? [] : stagedEnvironmentFiles(staged);
    if (environmentStaged.length > 0) return environmentRefusal(environmentStaged);
    if (stage === 'message' && options.messageFile !== undefined && !isReadable(options.messageFile))
        return {
            text: `The commit message file ${options.messageFile} cannot be read.\n`,
            json: { error: 'message-file' },
            exitCode: 2,
        };
    return undefined;
}

function unknownCheck(check: string): CommandResult {
    return {
        text: `No selected preset runs a check called \`${check}\` here. Run gspot explain ${check} to see which preset ships it.\n`,
        json: { error: 'unknown-check' },
        exitCode: 2,
    };
}

function selectedPaths(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const candidates = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set<string>();
    for (const path of options.paths) {
        const selector = relative(session.root, resolve(options.cwd, path)).split(sep).join('/');
        if (selector === '..' || selector.startsWith('../') || isAbsolute(selector))
            throw new SelectionError([`Path ${path} is outside this repository.`]);
        const matches = candidates.filter(
            (file) => selector === '' || file === selector || file.startsWith(`${selector}/`),
        );
        if (matches.length === 0) throw new SelectionError([`Path ${path} matches no repository files.`]);
        for (const match of matches) selected.add(match);
    }
    return [...selected];
}

function unknownSelection(session: Session, only: string[] | undefined): CommandResult | undefined {
    const known = new Set([
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...session.policyFiles.policy.checks.map((check) => check.name),
    ]);
    const unknown = only?.find((check) => !known.has(check));
    return unknown === undefined ? undefined : unknownCheck(unknown);
}

async function revisionSelection(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
): Promise<ChangedSet | undefined> {
    if ((options.staged || options.changed !== undefined) && !session.repository.hasGit)
        throw new SelectionError(['Revision selection requires a Git repository.']);
    return options.changed === undefined ? undefined : changedFiles(session.root, options.changed, signal);
}

function resultFor(
    options: CheckOptions,
    outcome: Awaited<ReturnType<typeof executeRun>>,
    unstaged: number,
    reportRoot?: string,
): CheckCommandResult {
    outcome.report.unstaged = unstaged;
    if (reportRoot !== undefined) writeReport(reportRoot, outcome.report);
    const rendered = runText(outcome.report, { quiet: options.quiet, verbose: options.verbose });
    const text = outcome.fixes ? fixSummary(outcome.fixes, options.isDryRun, rendered) : rendered;
    return { text, json: outcome.report, report: outcome.report, exitCode: outcome.report.exitCode };
}

/**
 * Runs check and returns what to print.
 * @param options the parsed flags
 * @returns the text, the run report and the exit code
 */
async function checkContent(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision?: {
        commits?: string[];
        historyComplete?: boolean;
        content: 'index' | 'commit';
        reference: string;
        reportRoot?: string;
        staged?: StagedSet;
        changed?: string[];
    },
): Promise<CheckCommandResult> {
    assertPinMatches(root);
    const session = await openSession(root);
    const unknown = unknownSelection(session, options.only);
    if (unknown !== undefined) return unknown;
    let changed =
        revision?.changed === undefined
            ? await revisionSelection(session, options, signal)
            : { reference: revision.reference, paths: revision.changed };
    if (revision?.content === 'commit' && session.policyFiles.policy.hooks?.push === 'all') changed = undefined;
    const set =
        revision?.staged ?? (options.staged ? await stagedFiles(root, signal) : { staged: undefined, unstaged: 0 });
    const stage: StageFilter = options.stage ?? (options.staged ? 'commit' : 'all');
    const refusal = refusalFor(options, stage, set.staged);
    if (refusal) return refusal;
    const paths = selectedPaths(
        session,
        options,
        [set.staged, changed?.paths].flatMap((selection) => selection ?? []),
    );
    const outcome = await executeRun(session, {
        ...runOptions({ ...options, paths }, stage, set.staged, changed),
        ...(revision === undefined ? {} : { comparison: { content: revision.content, reference: revision.reference } }),
        ...(revision?.commits === undefined ? {} : { commits: revision.commits }),
        ...(revision?.historyComplete === undefined ? {} : { historyComplete: revision.historyComplete }),
        cancelSignal: signal,
    });
    if (options.push !== undefined)
        for (const check of outcome.report.checks)
            if (check.reproduce !== undefined) check.reproduce = reproduceLine(check.check, check.scope, options);
    return resultFor(options, outcome, set.unstaged, revision?.reportRoot);
}

/** Check the working tree or an isolated, exact snapshot of the staged index. */
export async function checkCommand(options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    if ((options.staged || options.push !== undefined) && !isGitRepository(root))
        throw new SelectionError(['Revision selection requires a Git repository.']);
    if (options.push !== undefined) {
        if (
            options.staged ||
            options.changed !== undefined ||
            options.fix ||
            options.stage !== undefined ||
            options.messageFile !== undefined
        )
            throw new SelectionError([
                'Pre-push object checks cannot be combined with staged, changed, fix, stage, or message-file options.',
            ]);
        const selected = await pushedRevisions(root, options.push.input, options.push.remote, signal);
        const revisions: PushReport['revisions'] = [];
        const rendered: string[] = [];
        for (const revision of selected.revisions) {
            if (signal.aborted) break;
            let result: CheckCommandResult;
            try {
                result = await withRevisionSnapshot(
                    root,
                    { kind: 'commit', object: revision.object },
                    (snapshot) =>
                        checkContent(snapshot, options, signal, {
                            commits: revision.commits,
                            historyComplete: revision.historyComplete,
                            content: 'commit',
                            reference: revision.object,
                            ...(revision.paths === undefined ? {} : { changed: revision.paths }),
                        }),
                    signal,
                );
            } catch (error) {
                if (!signal.aborted) throw error;
                break;
            }
            if (result.report === undefined) return result;
            revisions.push({
                object: revision.object,
                refs: revision.refs,
                commits: revision.commits,
                historyComplete: revision.historyComplete,
                report: result.report,
            });
            rendered.push(`${revision.refs.join(', ')} at ${revision.object}\n${result.text}`);
        }
        const pendingRefs = selected.revisions.slice(revisions.length).flatMap((revision) => revision.refs);
        const exitCode = Math.max(signal.aborted ? 1 : 0, ...revisions.map((revision) => revision.report.exitCode));
        const report: PushReport = {
            revisions,
            notApplicable: selected.notApplicable,
            exitCode,
            ...(signal.aborted ? { canceled: { pendingRefs } } : {}),
        };
        if (signal.aborted)
            rendered.push(
                `Push checks canceled. References not checked: ${pendingRefs.join(', ') || 'none; see canceled checks above'}.\n`,
            );
        writeReport(root, report);
        return {
            text: [
                ...rendered,
                ...selected.notApplicable.map((entry) => `${entry.ref}: ${entry.reason}; no source check applies.\n`),
            ].join(''),
            json: report,
            exitCode,
        };
    }
    if (!options.staged) return checkContent(root, options, signal);
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
                reference: tree,
                staged: set,
                reportRoot: root,
            });
        },
        signal,
    );
}
