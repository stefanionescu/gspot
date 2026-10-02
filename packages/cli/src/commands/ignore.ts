import type { Command } from 'commander';
import { allChecks } from '#cli/kits/listing.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { similar } from '#cli/policy/similar.ts';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { appendIgnore, removeEntries } from '#cli/policy/write.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import { commitPolicy, requireReason } from '#cli/commands/policy.ts';
import { listFlag, textEntry, directoryOf } from '#cli/commands/flags.ts';
import type { CommandResult, IgnoreOptions } from '#cli/types/commands.ts';

function knownCheck(checkName: string, repositoryChecks: string[]): void {
    if (allChecks().has(checkName) || repositoryChecks.includes(checkName)) {
        return;
    }

    const known = [...allChecks().keys(), ...repositoryChecks];
    throw new GspotError('policy', [messages.unknownCheck(checkName, similar(checkName, known))]);
}

function ignoreCommandLine(o: IgnoreOptions): string {
    const rule = o.rule === undefined ? '' : ` --rule ${quoteArgument(o.rule)}`;
    const paths = o.paths === undefined ? '' : ` --paths ${o.paths.map((path) => quoteArgument(path)).join(' ')}`;
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
    const result = await commitPolicy(
        root,
        removeEntries(
            'ignore',
            (entry: TomlTable): boolean =>
                entry['check'] === o.check &&
                (entry['rule'] ?? undefined) === o.rule &&
                JSON.stringify(entry['paths'] ?? []) === paths,
            counter,
        ),
        false,
        '',
    );
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
async function ignoreCommand(o: IgnoreOptions): Promise<CommandResult> {
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
        .summary('Ignore a check or a rule')
        .description('Turn off a check, or one of its rules, for some paths or everywhere')
        .addHelpText(
            'after',
            '\nEffects:\nWrites the ignore to gspot.toml and applies the configuration. Every report lists the ignores, and --verbose prints each reason.\n\nExit codes:\n- 0: the ignore was written and applied.\n- 2: the input was invalid, or ignore could not finish.\n\nExample:\ngspot ignore bash/syntax --paths scripts/example.sh --reason "The file tests a syntax error."',
        )
        .option('--paths <glob...>', 'Apply the ignore to these paths only; without it, to the whole scope')
        .option('--rule <rule>', 'Turn off one rule of the check')
        .option('--reason <text>', 'Say why; required when require_reasons is true')
        .option('--remove', 'Delete the matching ignore')
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
