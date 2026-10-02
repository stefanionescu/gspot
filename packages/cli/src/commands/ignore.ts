import { isDeepStrictEqual } from 'node:util';
import { allChecks } from '#cli/kits/listing.ts';
import { readPolicy } from '#cli/policy/read.ts';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { compact, similar } from '#cli/platform/text.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import type { TomlTable } from '#cli/types/policy/policy.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { commitPolicy, requireReason } from '#cli/commands/edit.ts';
import { addIgnore, removeMatching } from '#cli/policy/mutations.ts';
import type { Program, CommandResult, IgnoreOptions } from '#cli/types/commands/commands.ts';

function assertKnownCheck(checkName: string, repositoryChecks: string[]): void {
    if (allChecks().has(checkName) || repositoryChecks.includes(checkName)) {
        return;
    }

    const known = [...allChecks().keys(), ...repositoryChecks];
    throw new GspotError('policy', [messages.unknownCheck(checkName, similar(checkName, known))]);
}

function buildReasonHint(o: IgnoreOptions): string {
    const rule = o.rule === undefined ? '' : ` --rule ${quoteArgument(o.rule)}`;
    const paths = o.paths === undefined ? '' : ` --paths ${o.paths.map((path) => quoteArgument(path)).join(' ')}`;
    return `gspot ignore ${quoteArgument(o.check)}${rule}${paths} --reason "..."`;
}

function buildIgnore(o: IgnoreOptions): { entry: TomlTable; lines: string[] } {
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

async function deleteIgnore(root: string, o: IgnoreOptions): Promise<CommandResult> {
    const counter = { removed: 0 };
    const result = await commitPolicy(
        root,
        removeMatching(
            'ignore',
            (entry: TomlTable): boolean =>
                entry['check'] === o.check &&
                (entry['rule'] ?? undefined) === o.rule &&
                isDeepStrictEqual(entry['paths'] ?? [], o.paths ?? []),
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
    assertKnownCheck(
        o.check,
        policy.checks.map((check) => check.name),
    );
    if (o.remove) return deleteIgnore(root, o);
    if (policy.requireReasons) requireReason(o.reason, `gspot ignore ${o.check}`, buildReasonHint(o));
    const { entry, lines } = buildIgnore(o);
    return commitPolicy(root, addIgnore(entry), false, lines.join('\n'));
}

/**
 * Registers ignore.
 * @param program the commander program
 */
export function registerIgnore(program: Program): void {
    program
        .command('ignore <check>')
        .summary('Ignore a check or a rule')
        .description(
            'Turn off a check, or one of its rules, for some paths or everywhere. The ignore goes into gspot.toml, and the configuration is applied. Every report lists the ignores, and --verbose prints each reason.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the ignore was written and applied.\n- 2: the input was invalid, or ignore could not finish.\n\nExample:\ngspot ignore bash/syntax --paths scripts/example.sh --reason "The file tests a syntax error."',
        )
        .option('--paths <glob...>', 'Apply the ignore to these paths only; without it, to the whole scope')
        .option('--rule <rule>', 'Turn off one rule of the check')
        .option('--reason <text>', 'Say why; required when require_reasons is true')
        .option('--remove', 'Delete the matching ignore')
        .action(async (check, flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                (cwd) =>
                    ignoreCommand({
                        cwd,
                        check,
                        remove: flags.remove === true,
                        ...compact({ paths: flags.paths, rule: flags.rule, reason: flags.reason }),
                    }),
                global,
            );
        });
}
