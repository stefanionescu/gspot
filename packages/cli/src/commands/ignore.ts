import { resolve } from 'node:path';
import { stringify } from 'smol-toml';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/output/messages.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import type { CommandResult } from '#cli/types/output.ts';
import { similar, codeList } from '#cli/platform/text.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { compact, isRecord } from '#cli/platform/objects.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { knownChecks } from '#cli/configurations/manifests.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { readPolicy, parseTomlText } from '#cli/policy/read.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import type { Policy, TomlTable } from '#cli/types/policy/settings.ts';
import { commitPolicy, requireReason } from '#cli/commands/policy-edit.ts';

/**
 * Adds an ignore: its paths join an entry with the same check, rule, reason, and expiry.
 * An ignore with no paths covers the whole scope, so it leaves the merged entry without paths.
 * @param raw the policy table
 * @param entry the ignore as the command built it
 */
function addIgnore(raw: TomlTable, entry: TomlTable): void {
    const list = (raw['ignore'] as TomlTable[] | undefined) ?? [];
    const same = list.find((existing) =>
        ['check', 'rule', 'reason', 'until'].every((field) => existing[field] === entry[field]),
    );
    if (same === undefined) {
        list.push(entry);
        raw['ignore'] = list;
        return;
    }
    const added = entry['paths'];
    const existing = same['paths'];
    if (!Array.isArray(added) || !Array.isArray(existing)) Reflect.deleteProperty(same, 'paths');
    else same['paths'] = [...new Set([...(existing as string[]), ...(added as string[])])];
}

function assertKnownCheck(checkName: string, policy: Policy): void {
    const known = knownChecks(policy.checks);
    if (known.includes(checkName)) return;
    throw new GspotError('policy', [
        `There is no check called \`${checkName}\`.${similar(checkName, known).length > 0 ? ' Did you mean ' + codeList(similar(checkName, known)) + '?' : ''}`,
    ]);
}

function buildReasonHint(options: IgnoreOptions): string {
    const rule = options.rule === undefined ? '' : ` --rule ${quoteArgument(options.rule)}`;
    const paths =
        options.paths === undefined ? '' : ` --paths ${options.paths.map((path) => quoteArgument(path)).join(' ')}`;
    return `gspot ignore ${quoteArgument(options.check)}${rule}${paths} --reason "..."`;
}

function buildIgnore(options: IgnoreOptions): TomlTable {
    const entry: TomlTable = { check: options.check };
    if (options.rule !== undefined) {
        entry['rule'] = options.rule;
    }
    if (options.paths !== undefined && options.paths.length > 0) {
        entry['paths'] = options.paths;
    }
    if (options.reason !== undefined) {
        entry['reason'] = options.reason;
    }
    if (options.until !== undefined) entry['until'] = options.until;
    return entry;
}

async function deleteIgnore(
    root: string,
    log: Log,
    options: IgnoreOptions,
    ignores: TomlTable[],
): Promise<CommandResult> {
    const selector = {
        check: options.check,
        rule: options.rule,
        ...compact({ reason: options.reason, until: options.until }),
    };
    const removed = new Set(options.paths);
    const hasMatchingRemoval = (entry: TomlTable): boolean => {
        if (!Object.entries(selector).every(([key, value]) => entry[key] === value)) return false;
        const paths = entry['paths'] as string[] | undefined;
        return removed.size === 0
            ? paths === undefined || paths.length === 0
            : paths?.some((path) => removed.has(path)) === true;
    };
    const removedCount = ignores.filter((entry) => hasMatchingRemoval(entry)).length;
    const noun = removedCount === 1 ? 'entry' : 'entries';
    const summary =
        removedCount === 0
            ? 'no matching ignore entry'
            : `removed ${String(removedCount)} ignore ${noun} for ${options.check}`;
    const committed = await commitPolicy(
        root,
        log,
        (raw) => {
            const list = (raw['ignore'] as TomlTable[] | undefined) ?? [];
            const kept = list.filter((entry) => {
                if (!hasMatchingRemoval(entry)) return true;
                if (removed.size === 0) return false;
                const paths = entry['paths'] as string[];
                const remaining = paths.filter((path) => !removed.has(path));
                entry['paths'] = remaining;
                return remaining.length > 0;
            });
            if (kept.length === 0) Reflect.deleteProperty(raw, 'ignore');
            else raw['ignore'] = kept;
        },
        summary,
    );
    return !committed.json.changed && committed.exitCode === 0 ? { ...committed, text: `${summary}\n` } : committed;
}

/**
 * gspot ignore: writes one [[ignore]] entry with its reason, or removes the entries that match.
 * @param options the parsed flags
 * @returns the command result
 */
async function ignoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const { policy, text } = readPolicy(root);
    assertKnownCheck(options.check, policy);
    if (!options.remove && policy.require_reasons)
        requireReason(options.reason, `gspot ignore ${options.check}`, buildReasonHint(options));
    using log = openOwnership(root);
    if (options.remove) {
        // Effective policy omits invalid ignores; removal can repair the authored entries too.
        const ignores = (parseTomlText(text, 'gspot.toml', 'policy')['ignore'] as TomlTable[] | undefined) ?? [];
        return await deleteIgnore(root, log, options, ignores);
    }
    const entry = buildIgnore(options);
    let written = '';
    const result = await commitPolicy(
        root,
        log,
        (raw) => {
            addIgnore(raw, entry);
            const list = raw['ignore'] as TomlTable[];
            const saved = list.find((existing) =>
                ['check', 'rule', 'reason', 'until'].every((key) => existing[key] === entry[key]),
            );
            written = stringify({ ignore: [saved] }).trimEnd();
        },
        'Ignore saved.',
    );
    return result.exitCode === 0 && isRecord(result.json) && result.json['changed']
        ? { ...result, text: `${written}\n${result.text}` }
        : result;
}

/**
 * Registers ignore.
 * @param program the commander program
 */
export function registerIgnore(program: Program): void {
    program
        .command('ignore')
        .argument('<check>', 'Check identifier to ignore or restore')
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
        .option('--until <date>', 'Stop applying this ignore on YYYY-MM-DD (UTC)')
        .option('--remove', 'Delete the matching ignore')
        .action(async (check, flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await ignoreCommand({
                    cwd,
                    check,
                    remove: flags.remove === true,
                    ...compact({ paths: flags.paths, rule: flags.rule, reason: flags.reason, until: flags.until }),
                }),
            );
        });
}
