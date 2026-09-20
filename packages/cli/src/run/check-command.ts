import { readFileSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';
import { note, warn } from '#cli/output/messages.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { findRoot } from '#cli/repository/tracked.ts';
// check: open the session, honor the pin, run, render, decide the exit code.
import type { ChangedSet } from '#types/repository.ts';
import { SelectionError } from '#cli/presets/select.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { changedFiles, stagedFiles } from '#cli/repository/staged.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#config/env-files.ts';
import type { CheckOptions, CommandResult, FixReport, RunOptions, StageFilter, Session } from '#types/run.ts';

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
    localSkips: string[],
): RunOptions {
    return {
        stage,
        skips: options.skips,
        localSkips,
        fix: options.fix,
        isDryRun: options.isDryRun,
        noCache: options.noCache,
        ...(staged === undefined ? {} : { staged }),
        ...(changed === undefined ? {} : { changed: changed.paths, comparison: changed.reference }),
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

function revisionSelection(session: Session, options: CheckOptions): ChangedSet | undefined {
    if ((options.staged || options.changed !== undefined) && !session.repository.hasGit)
        throw new SelectionError(['Revision selection requires a Git repository.']);
    return options.changed === undefined ? undefined : changedFiles(session.root, options.changed);
}

function resultFor(
    options: CheckOptions,
    outcome: Awaited<ReturnType<typeof executeRun>>,
    unstaged: number,
): CommandResult {
    outcome.report.unstaged = unstaged;
    const rendered = runText(outcome.report, { quiet: options.quiet, verbose: options.verbose });
    const text = outcome.fixes ? fixSummary(outcome.fixes, options.isDryRun, rendered) : rendered;
    return { text, json: outcome.report, exitCode: outcome.report.exitCode };
}

/**
 * Runs check and returns what to print.
 * @param options the parsed flags
 * @returns the text, the run report and the exit code
 */
export async function checkCommand(options: CheckOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    const unknown = unknownSelection(session, options.only);
    if (unknown !== undefined) return unknown;
    const changed = revisionSelection(session, options);
    const set = options.staged ? stagedFiles(root) : { staged: undefined, unstaged: 0 };
    const stage: StageFilter = options.stage ?? (options.staged ? 'commit' : 'all');
    const refusal = refusalFor(options, stage, set.staged);
    if (refusal) return refusal;
    const paths = selectedPaths(
        session,
        options,
        [set.staged, changed?.paths].flatMap((selection) => selection ?? []),
    );
    const outcome = await executeRun(
        session,
        runOptions({ ...options, paths }, stage, set.staged, changed, session.policyFiles.local.skip),
    );
    return resultFor(options, outcome, set.unstaged);
}
