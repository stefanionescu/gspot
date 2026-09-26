import { directoryOf, listFlag, textEntry } from '#cli/commands/flags.ts';
import { commitPolicy, requireReason } from '#cli/commands/policy.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { allChecks } from '#cli/configurations/listing.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import * as messages from '#cli/policy/messages.ts';
import { nearMatches } from '#cli/policy/near.ts';
import { PolicyError, readPolicy } from '#cli/policy/read.ts';
import { appendIgnore, removeEntries } from '#cli/policy/write.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import type { Command } from 'commander';

type IgnoreOptions = {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
    reason?: string;
    remove: boolean;
};

function knownCheck(checkName: string, repositoryChecks: string[]): void {
    if (allChecks().has(checkName) || repositoryChecks.includes(checkName)) {
        return;
    }

    const known = [...allChecks().keys(), ...repositoryChecks];
    throw new PolicyError([messages.unknownCheck(checkName, nearMatches(checkName, known))]);
}

function ignoreCommandLine(o: IgnoreOptions): string {
    const rule = o.rule === undefined ? '' : ` --rule ${quoteArgument(o.rule)}`;
    const paths = o.paths === undefined ? '' : ` --paths ${o.paths.map(quoteArgument).join(' ')}`;
    return `gspot ignore ${quoteArgument(o.check)}${rule}${paths} --reason "..."`;
}

function ignoreEntry(o: IgnoreOptions): { entry: TomlTable; lines: string[] } {
    const entry: TomlTable = { check: o.check };
    const lines = ['[[ignore]]', `check  = "${o.check}"`];
    if (o.rule !== undefined) {
        entry['rule'] = o.rule;
        lines.push(`rule   = "${o.rule}"`);
    }
    if (o.paths !== undefined && o.paths.length > 0) {
        entry['paths'] = o.paths;
        lines.push(`paths  = ${JSON.stringify(o.paths)}`);
    }
    if (o.reason !== undefined) {
        entry['reason'] = o.reason;
        lines.push(`reason = ${JSON.stringify(o.reason)}`);
    }
    return { entry, lines };
}

async function removeIgnore(root: string, o: IgnoreOptions): Promise<CommandResult> {
    const counter = { removed: 0 };
    const paths = JSON.stringify(o.paths ?? []);
    const isMatch = (entry: TomlTable): boolean =>
        entry['check'] === o.check &&
        (entry['rule'] ?? undefined) === o.rule &&
        JSON.stringify(entry['paths'] ?? []) === paths;
    const result = await commitPolicy(root, removeEntries('ignore', isMatch, counter), false, '');
    const noun = counter.removed === 1 ? 'entry' : 'entries';
    const text =
        counter.removed === 0
            ? 'no matching ignore entry'
            : `removed ${String(counter.removed)} ignore ${noun} for ${o.check}`;
    return { ...result, text: `${text}\n` };
}

/**
 * gspot ignore: writes one [[ignore]] entry with its reason, or removes the entries that match.
 * @param o the parsed flags
 * @returns the command result
 */
export async function ignoreCommand(o: IgnoreOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const { policy } = readPolicy(root);
    knownCheck(
        o.check,
        policy.checks.map((check) => check.name),
    );
    if (o.remove) return removeIgnore(root, o);
    if (policy.requireReasons) requireReason(o.reason, `gspot ignore ${o.check}`, ignoreCommandLine(o));
    const { entry, lines } = ignoreEntry(o);
    return commitPolicy(root, appendIgnore(entry), false, lines.join('\n'));
}

/**
 * Registers ignore.
 * @param program the commander program
 */
export function registerIgnore(program: Command): void {
    program
        .command('ignore <check>')
        .summary('Ignore a check or rule')
        .description('Turn a check, or one rule in it, off for some paths or everywhere')
        .addHelpText(
            'after',
            '\nEffects:\nWrites a policy exception and applies configuration. Select the check and optional rule or paths. When require_reasons is true, a meaningful reason is required.\n\nExit codes:\n0: the exception change was applied. 2: invalid input or inability to complete the request.\n\nExample:\ngspot ignore bash/syntax --paths scripts/example.sh --reason "The file is a syntax-error fixture."',
        )
        .option('--paths <glob...>', 'The paths the ignore applies to; none means the whole scope')
        .option('--rule <rule>', 'One rule inside the check')
        .option('--reason <text>', 'Optional explanation; required when require_reasons is true')
        .option('--remove', 'Delete the matching entry instead')
        .action(async (check: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            const paths = listFlag(flags, 'paths');
            await printCommand(
                () =>
                    ignoreCommand({
                        cwd: directoryOf(global),
                        check,
                        remove: flags['remove'] === true,
                        ...(paths === undefined ? {} : { paths }),
                        ...textEntry(flags, 'rule', 'rule'),
                        ...textEntry(flags, 'reason', 'reason'),
                    }),
                global,
            );
        });
}
