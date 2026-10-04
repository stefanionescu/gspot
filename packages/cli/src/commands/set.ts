// A bracketed list or table uses JSON or TOML syntax.
import { resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/output/messages.ts';
import { openSession } from '#cli/execution/session.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import type { CommandResult } from '#cli/types/output.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { SetOptions } from '#cli/types/commands/set.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { isLoosening } from '#cli/policy/problems/reasons.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { SettingSpec } from '#cli/types/configurations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import { specFor, settingValue } from '#cli/policy/settings/entries.ts';
import { unknownSettingDiagnostic } from '#cli/policy/problems/keys.ts';
import { commitPolicy, requireReason } from '#cli/commands/policy-edit.ts';
import type { RawPolicy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { DECIMAL, INTEGER, STRUCTURED } from '#cli/config/commands/options.ts';
import { setKey, addToList, deleteKey, getScopeTable, removeFromList } from '#cli/policy/edit.ts';

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

// The reason given on the command line goes into every table item that has none.
function fillReasons(value: unknown, reason: string | undefined): unknown {
    if (reason === undefined || !Array.isArray(value)) return value;
    return (value as unknown[]).map((item) =>
        item !== null && typeof item === 'object' && !('reason' in item) ? { ...item, reason } : item,
    );
}

function isReasonOwed(spec: SettingSpec, options: SetOptions, value: unknown, shipped: unknown): boolean {
    if (spec.type !== 'list') return isLoosening(spec, value, shipped);
    if (options.remove) return spec.direction !== 'loosening' && spec.direction !== 'neutral';
    // A nonempty list of explained tables already carries the reasons for its entries.
    const items: unknown[] = Array.isArray(value) ? value : [];
    if (
        items.length > 0 &&
        items.every(
            (item) => item !== null && typeof item === 'object' && 'reason' in item && typeof item.reason === 'string',
        )
    )
        return false;
    return options.replace ? spec.direction !== 'neutral' : isLoosening(spec, value, shipped);
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

function commitSetting(
    log: Log,
    session: Session,
    selection: ScopeSelection,
    options: SetOptions,
    spec: SettingSpec,
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
    const value = fillReasons(
        isPathList(options.key, parsed) && !options.remove ? [{ paths: parsed }] : parsed,
        isList ? options.reason : undefined,
    );
    assertReason(session, selection, options, spec, value);
    const written = !isList && options.reason !== undefined ? { value, reason: options.reason } : value;
    const shown = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    return commitPolicy(
        session.root,
        log,
        (raw) => {
            const holder = getScopeTable(raw, options.scope);
            if (options.remove && isPathList(options.key, value)) {
                const entries = (holder[options.key] ?? []) as NonNullable<RawPolicy['generated']>;
                holder[options.key] = entries
                    .map((entry) => ({ ...entry, paths: entry.paths.filter((path) => !value.includes(path)) }))
                    .filter((entry) => entry.paths.length > 0);
            } else if (isList && options.remove) removeFromList(holder, options.key, value as unknown[]);
            else if (isList && !options.replace) addToList(holder, options.key, value as unknown[]);
            else setKey(holder, options.key, written);
        },
        describeSet(session, selection, options, shown, value, isList),
    );
}

/**
 * gspot set: writes one setting, appends to or edits a list, or deletes the key with --default.
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
    using log = openOwnership(root);
    if (!options.reset) return await commitSetting(log, session, selection, options, match.spec);
    const shown = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    return await commitPolicy(
        root,
        log,
        (raw) => {
            deleteKey(getScopeTable(raw, options.scope), options.key);
        },
        `${shown} back to the shipped default`,
    );
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
            'Write one setting to gspot.toml and apply it. gspot checks the value first. The key is the dotted name gspot list settings prints. A list value adds to the list unless you pass --replace or --remove. set installs no tools: run gspot install for that.',
        )
        .addHelpText(
            'after',
            '\nLevels:\nrecommended, the default, checks correctness, security, accessibility, type safety, dependency health, formatting, and declared project contracts. all adds stable conventions for naming, architecture, documentation, API style, and complexity. Neither level turns on experimental or preview rules.\n\nExit codes:\n- 0: the setting was written and applied.\n- 2: the input was invalid, or set could not finish.\n\nExample:\ngspot set level all',
        )
        .option('--reason <text>', 'Say why; required to loosen a setting when require_reasons is true')
        .option('--scope <path>', 'Write the setting in this scope instead of the root')
        .option('--replace', 'Replace the whole list instead of adding to it')
        .option('--remove', 'Remove these items from the list')
        .option('--default', 'Delete the setting so the inherited or default value applies')
        .action(async (key, items, flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await setCommand({
                    cwd,
                    key,
                    items,
                    replace: flags.replace === true,
                    remove: flags.remove === true,
                    reset: flags.default === true,
                    ...compact({ reason: flags.reason, scope: flags.scope }),
                }),
            );
        });
}
