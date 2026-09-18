// check: open the session, honor the pin, run, render, decide the exit code.
import { readFileSync } from 'node:fs';

import { renderRun } from '#cli/output/reporter.ts';
import { note, warn } from '#cli/output/messages.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { changedSince, stagedFiles } from '#cli/repository/staged.ts';
import { executeRun } from '#cli/run/execute.ts';
import type { StageFilter } from '#cli/run/plan.ts';
import { openSession } from '#cli/run/session.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#config/env-files.ts';
import { pathMatcher } from '#cli/presets/claims.ts';

export type CheckOptions = {
    cwd: string;
    check?: string;
    staged: boolean;
    since?: string;
    fix: boolean;
    dryRun: boolean;
    stage?: StageFilter;
    scope?: string;
    skips: string[];
    messageFile?: string;
    quiet: boolean;
    verbose: boolean;
    noCache: boolean;
};

export type CommandResult = { text: string; json: unknown; exitCode: number };

/** Runs check and returns what to print. */
export async function checkCommand(options: CheckOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    let staged: string[] | undefined;
    let unstaged = 0;
    if (options.staged) {
        const set = stagedFiles(root);
        staged = set.staged;
        unstaged = set.unstaged;
        const envMatcher = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));
        const envStaged = staged.filter(
            (path) => envMatcher(path) && !ENV_TEMPLATE_NAMES.includes(path.split('/').pop()!),
        );
        if (envStaged.length > 0) {
            return {
                text: `An environment file is staged: ${envStaged.join(', ')}. Unstage it (git restore --staged <file>); only templates like .env.example belong in git.\n`,
                json: { failed: ['integrity/env-files'], files: envStaged },
                exitCode: 1,
            };
        }
    }
    const since = options.since !== undefined ? changedSince(root, options.since) : undefined;
    const stage: StageFilter = options.stage ?? (options.staged ? 'commit' : 'all');
    if (stage === 'message' && options.messageFile !== undefined) {
        try {
            readFileSync(options.messageFile, 'utf8');
        } catch {
            return {
                text: `The commit message file ${options.messageFile} cannot be read.\n`,
                json: { error: 'message-file' },
                exitCode: 2,
            };
        }
    }
    const outcome = await executeRun(session, {
        stage,
        skips: options.skips,
        localSkips: session.loaded.local.skip,
        fix: options.fix,
        dryRun: options.dryRun,
        noCache: options.noCache,
        ...(staged ? { staged } : {}),
        ...(since ? { since } : {}),
        ...(options.check !== undefined ? { only: options.check } : {}),
        ...(options.scope !== undefined ? { scope: options.scope } : {}),
        ...(options.messageFile !== undefined ? { messageFile: options.messageFile } : {}),
    });
    outcome.record.unstaged = unstaged;
    if (options.check !== undefined && outcome.planned.length === 0) {
        return {
            text: `No selected preset runs a check called \`${options.check}\` here. Run gspot explain ${options.check} to see which preset ships it.\n`,
            json: { error: 'unknown-check' },
            exitCode: 2,
        };
    }
    let text = renderRun(outcome.record, { quiet: options.quiet, verbose: options.verbose });
    if (outcome.fixes) {
        if (options.dryRun)
            text = `${outcome.fixes.diffs.join('\n')}\n${outcome.fixes.changed.length === 0 ? 'no fixer changes anything' : `${outcome.fixes.changed.length} file(s) would change`}\n\n${text}`;
        else if (outcome.fixes.changed.length > 0) {
            warn(
                `fixers changed ${outcome.fixes.changed.length} file(s); the changes are in the working tree and are not staged: ${outcome.fixes.changed.slice(0, 8).join(' ')}${outcome.fixes.changed.length > 8 ? ' ...' : ''}`,
            );
        } else note('no fixer changed anything');
    }
    return { text, json: outcome.record, exitCode: outcome.record.exitCode };
}
