// Preview or publish setting changes with the same validation and mutation.
import { resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { Option } from '@commander-js/extra-typings';
import type { Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { printResult } from '#cli/terminal/messages.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { isReasoned } from '#cli/policy/schema/fields.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { isLoosening } from '#cli/policy/errors/reasons.ts';
import type { SetOptions } from '#cli/types/commands/set.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { compact, isRecord } from '#cli/platform/objects.ts';
import type { Program } from '#cli/types/commands/program.ts';
import type { SettingSpec } from '#cli/types/configurations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import { unknownSettingDiagnostic } from '#cli/policy/errors/keys.ts';
import { specFor, settingValue } from '#cli/policy/settings/lookup.ts';
import { DECIMAL, INTEGER, STRUCTURED } from '#cli/config/commands/options.ts';
import { commitPolicy, previewPolicy, requireReason } from '#cli/commands/policy-edit.ts';
import { setKey, addToList, deleteKey, getScopeTable, removeFromList } from '#cli/policy/edit.ts';
import type { Mutation, Reasoned, RawPolicy, ScopeSelection } from '#cli/types/policy/settings.ts';

// Text that reads as neither is refused: kept as a string, it lands in the policy as a quoted table nothing reads.
function parseStructured(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        // The TOML form is tried next.
    }
    try {
        return parseToml(`value = ${text}`)['value'];
    } catch {
        throw new GspotError('policy', [
            `The value ${text} reads as neither JSON nor TOML. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.`,
        ]);
    }
}

function parseItem(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (INTEGER.test(text) || DECIMAL.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function buildSettingError(session: Session, selection: ScopeSelection, key: string): GspotError {
    // A setting of a configuration that lives in a scope is set in that scope; say which one.
    const holder = session.scopes.find((entry) => specFor(entry.surface, key) !== undefined);
    if (holder !== undefined)
        return new GspotError('policy', [
            `A configuration has the setting \`${key}\` in ${holder.scope.path === '' ? 'the root; leave --scope out' : 'the scope `' + holder.scope.path + '`; add --scope ' + quoteArgument(holder.scope.path)}.`,
        ]);
    return new GspotError('policy', [unknownSettingDiagnostic(selection.surface, key)]);
}

function unwrap(parsed: unknown[], isList: boolean): unknown {
    if (parsed.length !== 1) return parsed;
    const [only] = parsed;
    if (!isList) return only;
    return Array.isArray(only) ? (only as unknown[]) : parsed;
}

function isPathList(key: string, value: unknown): value is string[] {
    return (
        (key === 'generated' || key === 'vendored') &&
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
    );
}

// Structured entries keep their own reasons; primitive lists save one reason with the whole value.
function settingReasonValue(value: unknown, spec: SettingSpec, reason: string | undefined): unknown {
    if (reason === undefined) return value;
    if (spec.type !== 'list') return { value, reason };
    const entries = value as unknown[];
    if (entries.some((item) => isRecord(item)))
        return entries.map((item) => (isRecord(item) && !('reason' in item) ? { ...item, reason } : item));
    return spec.direction === 'loosening' ? { value, reason } : value;
}

function isReasonOwed(spec: SettingSpec, options: SetOptions, value: unknown, shipped: unknown): boolean {
    if (spec.type !== 'list') return isLoosening(spec, value, shipped);
    if (options.remove) return spec.direction !== 'loosening' && spec.direction !== 'neutral';
    // A nonempty list of explained tables already carries the reasons for its entries.
    const items = value as unknown[];
    if (items.length > 0 && items.every((item) => isRecord(item) && typeof item['reason'] === 'string')) return false;
    return (options.replace && spec.direction === 'tightening') || isLoosening(spec, value, shipped);
}

// What set did: the new value, or the items it added to or removed from a list.
function changeText(options: SetOptions, isList: boolean, label: string, value: unknown): string {
    const items = JSON.stringify(value);
    if (!isList || options.replace) return `${label} = ${items}`;
    return `${options.remove ? 'removed from' : 'added to'} ${label}: ${items}`;
}

function describeSet(
    session: Session,
    selection: ScopeSelection,
    options: SetOptions,
    label: string,
    value: unknown,
    isList: boolean,
): string {
    const previous = settingValue(selection.surface, session.policyFiles.policy, options.key, options.scope);
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    const was = previous === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    return `${changeText(options, isList, label, value)}${reason}${was}`;
}

function getSelection(session: Session, scope: string | undefined): ScopeSelection {
    const selection = session.scopes.find((entry) => entry.scope.path === (scope ?? ''));
    if (!selection)
        throw new GspotError('policy', [
            `No policy scope matches ${scope ?? 'root'}. Available scopes: ${session.scopes.map((entry) => entry.scope.path || 'root').join(', ')}.`,
        ]);
    return selection;
}

// Quote policy values and preserve the mutation flags in the missing-reason command hint.
function buildReasonHint(options: SetOptions): string {
    const command = ['gspot', 'set', quoteArgument(options.key), ...options.items.map((item) => quoteArgument(item))];
    if (options.scope !== undefined) command.push('--scope', quoteArgument(options.scope));
    if (options.replace) command.push('--replace');
    if (options.remove) command.push('--remove');
    command.push('--reason', '"..."');
    return command.join(' ');
}

function assertReason(
    session: Session,
    selection: ScopeSelection,
    options: SetOptions,
    spec: SettingSpec,
    value: unknown,
): void {
    if (!session.policyFiles.policy.require_reasons) return;
    const shipped = selection.surface.defaults.get(spec.name)?.value;
    const where = `gspot set ${options.key}`;
    if (isReasonOwed(spec, options, value, shipped) || options.reason !== undefined)
        requireReason(options.reason, where, buildReasonHint(options));
}

async function changeSetting(
    session: Session,
    selection: ScopeSelection,
    options: SetOptions,
    spec: SettingSpec,
    shown: string,
): Promise<CommandResult> {
    if (options.items.length === 0)
        throw new GspotError('policy', [
            `The setting ${options.key} needs a value; pass one, or --default to remove yours.`,
        ]);
    const isList = spec.type === 'list';
    const parsed = unwrap(
        options.items.map((item) => parseItem(item)),
        isList,
    );
    const entries = isPathList(options.key, parsed) && !options.remove ? [{ paths: parsed }] : parsed;
    const written = settingReasonValue(entries, spec, options.reason);
    const change = isReasoned(written) ? written : { value: written };
    const value = change.value;
    assertReason(session, selection, options, spec, value);
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        if (options.remove && isPathList(options.key, value)) {
            const entries = (holder[options.key] ?? []) as NonNullable<RawPolicy['generated']>;
            holder[options.key] = entries
                .map((entry) => ({ ...entry, paths: entry.paths.filter((path) => !value.includes(path)) }))
                .filter((entry) => entry.paths.length > 0);
        } else if (isList && options.remove) removeFromList(holder, options.key, change as Reasoned<unknown[]>);
        else if (isList && !options.replace) addToList(holder, options.key, change as Reasoned<unknown[]>);
        else setKey(holder, options.key, written);
    };
    const summary = describeSet(session, selection, options, shown, value, isList);
    if (options.isDryRun) return previewPolicy(session.root, mutation, summary);
    using log = openOwnership(session.root);
    return await commitPolicy(session.root, log, mutation, summary);
}

/**
 * Previews or writes a setting, edits a list, or returns a key to its default.
 * @param options the parsed flags
 * @returns the command result
 */
async function setCommand(options: SetOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const session = await openSession(root);
    const selection = getSelection(session, options.scope);
    const match = specFor(selection.surface, options.key);
    if (!match) throw buildSettingError(session, selection, options.key);
    const shown = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    if (!options.toDefault) return await changeSetting(session, selection, options, match.spec, shown);
    const mutation: Mutation = (raw) => {
        deleteKey(getScopeTable(raw, options.scope), options.key);
    };
    const summary = `${shown} back to the shipped default`;
    if (options.isDryRun) return previewPolicy(root, mutation, summary);
    using log = openOwnership(root);
    return await commitPolicy(root, log, mutation, summary);
}

/**
 * Registers set.
 * @param program the commander program
 */
export function registerSet(program: Program): void {
    program
        .command('set')
        .argument('<key>', 'Dotted setting name from gspot list settings')
        .argument('[value...]', 'Setting value or list items; omit with --default')
        .summary('Change a setting')
        .description(
            'Write one setting to gspot.toml and apply it. gspot checks the value first. The key is the dotted name gspot list settings prints. A list value adds to the list unless you pass --replace or --remove. Use only one of --replace, --remove, and --default. --default takes no value. set installs no tools: run gspot install for that. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nLevels:\nrecommended, the default, checks correctness, security, accessibility, type safety, dependency health, formatting, and declared project contracts. all adds stable conventions for naming, architecture, documentation, API style, and complexity. Neither level turns on experimental or preview rules.\n\nExit codes:\n- 0: the setting was written and applied, or the preview finished.\n- 2: the input was invalid, or set could not finish.\n\nExample:\ngspot set level all',
        )
        .option('--reason <text>', 'Say why; required to loosen a setting when require_reasons is true')
        .option('--scope <path>', 'Write the setting in this scope instead of the root')
        .addOption(new Option('--replace', 'Replace the whole list; use --replace or --remove').conflicts('remove'))
        .option('--remove', 'Remove these items from the list')
        .addOption(
            new Option(
                '--default',
                'Restore the inherited or default value. Omit values, --replace, and --remove.',
            ).conflicts(['replace', 'remove']),
        )
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (key, items, flags, command) => {
            if (flags.default === true && items.length > 0)
                command.error('--default cannot be used with setting values.', { exitCode: EXIT_ERROR });
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await setCommand({
                    cwd,
                    key,
                    items,
                    replace: flags.replace === true,
                    remove: flags.remove === true,
                    toDefault: flags.default === true,
                    isDryRun: flags.dryRun === true,
                    ...compact({ reason: flags.reason, scope: flags.scope }),
                }),
            );
        });
}
