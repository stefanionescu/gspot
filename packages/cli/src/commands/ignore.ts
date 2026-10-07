import { resolve } from 'node:path';
import { stringify } from 'smol-toml';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/terminal/messages.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { knownChecks } from '#cli/configurations/manifests.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { readPolicy, parseTomlText } from '#cli/policy/read.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { similar, codeList, quoteArgument } from '#cli/platform/text.ts';
import type { Policy, Mutation, TomlTable } from '#cli/types/policy/settings.ts';
import { commitPolicy, previewPolicy, requireReason } from '#cli/commands/policy-edit.ts';

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

async function deleteIgnore(root: string, options: IgnoreOptions, ignores: TomlTable[]): Promise<CommandResult> {
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
    const mutation: Mutation = (raw) => {
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
    };
    if (options.isDryRun) return previewPolicy(root, mutation, summary);
    using log = openOwnership(root);
    const committed = await commitPolicy(root, log, mutation, summary);
    return !committed.json.changed && committed.exitCode === 0 ? { ...committed, text: `${summary}\n` } : committed;
}

/**
 * Previews or writes an ignore addition or removal.
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
    if (options.remove) {
        // Effective policy omits invalid ignores; removal can repair the authored entries too.
        const ignores = (parseTomlText(text, POLICY_FILE, 'policy')['ignore'] as TomlTable[] | undefined) ?? [];
        return await deleteIgnore(root, options, ignores);
    }
    const entry = buildIgnore(options);
    let written = '';
    const mutation: Mutation = (raw) => {
        addIgnore(raw, entry);
        const list = raw['ignore'] as TomlTable[];
        const saved = list.find((existing) =>
            ['check', 'rule', 'reason', 'until'].every((key) => existing[key] === entry[key]),
        );
        written = stringify({ ignore: [saved] }).trimEnd();
    };
    if (options.isDryRun) {
        const preview = previewPolicy(root, mutation, 'Ignore proposed.');
        return { ...preview, text: `${written}\n${preview.text}` };
    }
    using log = openOwnership(root);
    const result = await commitPolicy(root, log, mutation, 'Ignore saved.');
    return result.exitCode === 0 && result.json.changed ? { ...result, text: `${written}\n${result.text}` } : result;
}

/**
 * Registers ignore.
 * @param program the commander program
 */
export function registerIgnore(program: Program): void {
    program
        .command('ignore')
        .argument('<check>', 'Check ID to ignore or restore')
        .summary('Ignore a check or a rule')
        .description(
            'Turn off a check, or one of its rules, for some paths or everywhere. The ignore goes into gspot.toml, and the configuration is applied. Every report lists the ignores, and --verbose prints each reason. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the ignore was written and applied, or the preview finished.\n- 2: the input was invalid, or ignore could not finish.\n\nExample:\ngspot ignore bash/syntax --paths scripts/example.sh --reason "The file tests a syntax error."',
        )
        .option('--paths <glob...>', 'Apply the ignore to these paths only; without it, everywhere')
        .option('--rule <rule>', 'Turn off one rule of the check')
        .option('--reason <text>', 'Say why; required when require_reasons is true')
        .option('--until <date>', 'Stop applying this ignore on YYYY-MM-DD (UTC)')
        .option('--remove', 'Delete the matching ignore entries')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (check, flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await ignoreCommand({
                    cwd,
                    check,
                    remove: flags.remove === true,
                    isDryRun: flags.dryRun === true,
                    ...compact({ paths: flags.paths, rule: flags.rule, reason: flags.reason, until: flags.until }),
                }),
            );
        });
}
