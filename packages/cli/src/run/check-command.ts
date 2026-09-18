// check: open the session, honor the pin, run, render, decide the exit code.
import { readFileSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';
import { note, warn } from '#cli/output/messages.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { changedSince, stagedFiles } from '#cli/repository/staged.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#config/env-files.ts';
import type { CheckOptions, CommandResult, FixReport, RunOptions, StageFilter } from '#types/run.ts';

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
    since: string[] | undefined,
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
        ...(since === undefined ? {} : { since }),
        ...(options.check === undefined ? {} : { only: options.check }),
        ...(options.scope === undefined ? {} : { scope: options.scope }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
}

function fixSummary(fixes: FixReport, isDryRun: boolean, text: string): string {
    for (const line of fixes.failed) warn(`a fixer failed: ${line}`);
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

function resultFor(
    options: CheckOptions,
    outcome: Awaited<ReturnType<typeof executeRun>>,
    unstaged: number,
): CommandResult {
    outcome.record.unstaged = unstaged;
    if (options.check !== undefined && outcome.planned.length === 0) return unknownCheck(options.check);
    const rendered = runText(outcome.record, { quiet: options.quiet, verbose: options.verbose });
    const text = outcome.fixes ? fixSummary(outcome.fixes, options.isDryRun, rendered) : rendered;
    return { text, json: outcome.record, exitCode: outcome.record.exitCode };
}

/**
 * Runs check and returns what to print.
 * @param options the parsed flags
 * @returns the text, the run record and the exit code
 */
export async function checkCommand(options: CheckOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    const set = options.staged ? stagedFiles(root) : { staged: undefined, unstaged: 0 };
    const stage: StageFilter = options.stage ?? (options.staged ? 'commit' : 'all');
    const refusal = refusalFor(options, stage, set.staged);
    if (refusal) return refusal;
    const since = options.since === undefined ? undefined : changedSince(root, options.since);
    const outcome = await executeRun(
        session,
        runOptions(options, stage, set.staged, since, session.policyFiles.local.skip),
    );
    return resultFor(options, outcome, set.unstaged);
}
