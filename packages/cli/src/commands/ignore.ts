import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readPolicy } from '#cli/policy/read.ts';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/terminal/messages.ts';
import { savePolicy } from '#cli/commands/save-policy.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { knownChecks } from '#cli/configurations/manifests.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import { reasonDiagnostic } from '#cli/policy/errors/reasons.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { similar, codeList, quoteArgument } from '#cli/platform/text.ts';
import type { Policy, Mutation, TomlTable } from '#cli/types/policy/settings.ts';
import { emitPolicy, mergeIgnore, parseTomlText, parseExpiryDate } from '#cli/policy/file.ts';

function assertKnownCheck(checkName: string, policy: Policy): void {
    const known = knownChecks(Object.values(policy.check));
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
    if (options.until !== undefined) entry['until'] = parseExpiryDate(options.until);
    return entry;
}

async function deleteIgnore(root: string, options: IgnoreOptions, ignores: TomlTable[]): Promise<CommandResult> {
    const selector = {
        check: options.check,
        rule: options.rule,
        ...compact({
            reason: options.reason,
            until: options.until === undefined ? undefined : parseExpiryDate(options.until),
        }),
    };
    const removed = new Set(options.paths);
    const hasMatchingRemoval = (entry: TomlTable): boolean => {
        if (!Object.entries(selector).every(([key, value]) => isDeepStrictEqual(entry[key], value))) return false;
        const paths = entry['paths'] as string[] | undefined;
        return removed.size === 0
            ? paths === undefined || paths.length === 0
            : paths?.some((path) => removed.has(path)) === true;
    };
    const removedCount = ignores.filter((entry) => hasMatchingRemoval(entry)).length;
    const noun = removedCount === 1 ? 'entry' : 'entries';
    const summary =
        removedCount === 0
            ? 'nothing to remove: no matching ignore entry'
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
    const committed = await savePolicy(root, { change: mutation, summary, isDryRun: options.isDryRun });
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
    if (!options.remove) {
        const diagnostic = reasonDiagnostic(`gspot ignore ${options.check}`, options.reason, buildReasonHint(options));
        if (diagnostic !== undefined) throw new GspotError('policy', diagnostic);
    }
    if (options.remove) {
        // Effective policy omits invalid ignores; removal can repair the authored entries too.
        const ignores = (parseTomlText(text, POLICY_FILE, 'policy')['ignore'] as TomlTable[] | undefined) ?? [];
        return await deleteIgnore(root, options, ignores);
    }
    const entry = buildIgnore(options);
    let written = '';
    const result = await savePolicy(root, {
        change: (raw) => {
            const list = (raw['ignore'] as TomlTable[] | undefined) ?? [];
            const saved = mergeIgnore(list, entry);
            raw['ignore'] = list;
            written = emitPolicy('', { ignore: [saved] }).trimEnd();
        },
        summary: options.isDryRun ? 'Ignore proposed.' : 'Ignore saved.',
        isDryRun: options.isDryRun,
    });
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
            'Turn off a check, or one of its rules, for some paths or everywhere. The ignore goes into gspot.toml, and gspot applies the policy. Every report lists the ignores, and --verbose prints each reason. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the ignore was written and applied, or the preview finished.\n- 2: the input was invalid, or ignore could not finish.\n\nExample:\ngspot ignore bash/syntax --paths scripts/example.sh --reason "The file tests a syntax error."\ngspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."',
        )
        .option('--paths <glob...>', 'Apply the ignore to these paths only; without it, everywhere')
        .option('--rule <rule>', 'Turn off one rule of the check')
        .option('--reason <text>', 'Say why; required when adding an ignore')
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
