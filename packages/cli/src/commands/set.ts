// A bracketed list or table uses JSON or TOML syntax.

import type { Command } from 'commander';
import { parse as parseToml } from 'smol-toml';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import type { SettingSpec } from '#cli/types/kits.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/execution/session.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { TOOL_KEY_DEPTH } from '#cli/config/policy/policy.ts';
import { specFor, settingValue } from '#cli/policy/settings.ts';
import { textEntry, directoryOf } from '#cli/commands/flags.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { isWeaker, isReasonAccepted } from '#cli/policy/weaker.ts';
import { commitPolicy, requireReason } from '#cli/commands/edit.ts';
import type { SetOptions, CommandResult } from '#cli/types/commands.ts';
import type { Mutation, RawPolicy, ScopeSelection } from '#cli/types/policy/policy.ts';
import { setKey, deleteKey, appendList, scopeHolder, removeFromList } from '#cli/policy/write.ts';
import { DECIMAL, INTEGER, STRUCTURED, RULE_KEY_DEPTH, SET_NEAR_LIMIT } from '#cli/config/commands/commands.ts';

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
        throw new GspotError('policy', [messages.unreadableValue(text)]);
    }
}

function parseValue(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (INTEGER.test(text) || DECIMAL.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function unknownSetting(session: Session, selection: ScopeSelection, key: string): GspotError {
    // A setting of a configuration that lives in a scope is set in that scope; say which one.
    const holder = session.scopes.find((entry) => specFor(entry.surface, key) !== undefined);
    if (holder !== undefined) return new GspotError('policy', [messages.settingInScope(key, holder.scope.path)]);
    const depth = key.startsWith('tools.') ? TOOL_KEY_DEPTH : 1;
    const prefix = key.split('.').slice(0, depth).join('.');
    const all = selection.surface.specs.keys().toArray();
    const known = all.filter((entry) => entry.startsWith(`${prefix}.`)).map((entry) => entry.slice(prefix.length + 1));
    return new GspotError('policy', [
        messages.settingNotExposed(key, known.length > 0 ? known : all.slice(0, SET_NEAR_LIMIT)),
    ]);
}

function shaped(parsed: unknown[], isList: boolean): unknown {
    if (parsed.length !== 1) return parsed;
    const [only] = parsed;
    if (!isList) return only;
    return Array.isArray(only) ? (only as unknown[]) : parsed;
}

function declarationPaths(key: string, value: unknown): value is string[] {
    return (
        (key === 'generated' || key === 'vendored') &&
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
    );
}

// The reason given on the command line goes into every table item that has none.
function reasonsFilled(value: unknown, reason: string | undefined): unknown {
    if (reason === undefined || !Array.isArray(value)) return value;
    return (value as unknown[]).map((item) =>
        item !== null && typeof item === 'object' && !('reason' in item) ? { ...item, reason } : item,
    );
}

function isReasonOwed(spec: SettingSpec, o: SetOptions, value: unknown, shipped: unknown): boolean {
    if (spec.kind !== 'list') return isWeaker(spec, value, shipped);
    if (o.remove) return spec.direction !== 'loosening' && spec.direction !== 'neutral';
    // A nonempty list of explained tables already carries the reasons for its entries.
    const items: unknown[] = Array.isArray(value) ? value : [];
    if (
        items.length > 0 &&
        items.every(
            (item) => item !== null && typeof item === 'object' && 'reason' in item && typeof item.reason === 'string',
        )
    )
        return false;
    return o.replace ? spec.direction !== 'neutral' : isWeaker(spec, value, shipped);
}

function setMutation(o: SetOptions, isList: boolean, value: unknown): Mutation {
    const written = !isList && o.reason !== undefined ? { value, reason: o.reason } : value;
    return (raw) => {
        const holder = scopeHolder(raw, o.scope);
        if (o.remove && declarationPaths(o.key, value)) {
            const entries = (holder[o.key] ?? []) as NonNullable<RawPolicy['generated']>;
            holder[o.key] = entries
                .map((entry) => ({ ...entry, paths: entry.paths.filter((path) => !value.includes(path)) }))
                .filter((entry) => entry.paths.length > 0);
        } else if (isList && o.remove) removeFromList(o.key, value as unknown[])(holder);
        else if (isList && !o.replace) appendList(o.key, value as unknown[])(holder);
        else setKey(o.key, written)(holder);
    };
}

function describeSet(
    session: Session,
    selection: ScopeSelection,
    o: SetOptions,
    shown: string,
    value: unknown,
): string {
    const current = settingValue(selection.surface, session.policyFiles.policy, o.key, o.scope);
    const reason = o.reason === undefined ? '' : `  # ${o.reason}`;
    const was = current === undefined ? '' : `  (was ${JSON.stringify(current.value)} from ${current.source})`;
    return `${shown} = ${JSON.stringify(value)}${reason}${was}`;
}

function refuseRuleOff(spec: SettingSpec, o: SetOptions): void {
    if (spec.direction !== 'per-rule' || !o.items.includes('off')) return;
    const tool = o.key.split('.', TOOL_KEY_DEPTH)[1] ?? '';
    const rule = o.key.split('.').slice(RULE_KEY_DEPTH).join('.');
    throw new GspotError('policy', [messages.ruleOffRefused(`<the check that runs ${tool}>`, rule)]);
}

function selectionFor(session: Session, scope: string | undefined): ScopeSelection {
    const selection = session.scopes.find((entry) => entry.scope.path === (scope ?? '')) ?? session.scopes[0];
    if (!selection) throw new GspotError('policy', [messages.scopeMissing(scope ?? '')]);
    return selection;
}

// Quote policy values and preserve the mutation flags in the missing-reason command hint.
function setReasonCommand(options: SetOptions): string {
    const command = ['gspot', 'set', quoteArgument(options.key), ...options.items.map((item) => quoteArgument(item))];
    if (options.scope !== undefined) command.push('--scope', quoteArgument(options.scope));
    if (options.replace) command.push('--replace');
    if (options.remove) command.push('--remove');
    command.push('--reason', '"..."');
    return command.join(' ');
}

function validateSetReason(
    session: Session,
    selection: ScopeSelection,
    o: SetOptions,
    spec: SettingSpec,
    value: unknown,
): void {
    if (!session.policyFiles.policy.requireReasons) return;
    const shipped = selection.surface.defaults.get(spec.name)?.value;
    const where = `gspot set ${o.key}`;
    if (isReasonOwed(spec, o, value, shipped)) requireReason(o.reason, where, setReasonCommand(o));
    else if (o.reason !== undefined && !isReasonAccepted(o.reason))
        throw new GspotError('policy', [messages.refusedReason(where, o.reason)]);
}

function writeValue(
    root: string,
    session: Session,
    selection: ScopeSelection,
    o: SetOptions,
    spec: SettingSpec,
): Promise<CommandResult> {
    if (o.items.length === 0)
        throw new GspotError('policy', [`The setting ${o.key} needs a value; pass one, or --default to remove yours.`]);
    const isList = spec.kind === 'list';
    const parsed = shaped(
        o.items.map((item) => parseValue(item)),
        isList,
    );
    const value = reasonsFilled(
        declarationPaths(o.key, parsed) && !o.remove ? [{ paths: parsed }] : parsed,
        isList ? o.reason : undefined,
    );
    validateSetReason(session, selection, o, spec, value);
    const shown = o.scope === undefined ? o.key : `scope.${o.scope}.${o.key}`;
    return commitPolicy(root, setMutation(o, isList, value), false, describeSet(session, selection, o, shown, value));
}

/**
 * gspot set: writes one setting, appends to or edits a list, or deletes the key with --default.
 * @param o the parsed flags
 * @returns the command result
 */
async function setCommand(o: SetOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    const selection = selectionFor(session, o.scope);
    const match = specFor(selection.surface, o.key);
    if (!match) throw unknownSetting(session, selection, o.key);
    refuseRuleOff(match.spec, o);
    if (!o.toDefault) return writeValue(root, session, selection, o, match.spec);
    const shown = o.scope === undefined ? o.key : `scope.${o.scope}.${o.key}`;
    return commitPolicy(
        root,
        (raw) => {
            deleteKey(o.key)(scopeHolder(raw, o.scope));
        },
        false,
        `${shown} back to the shipped default`,
    );
}

/**
 * Registers set.
 * @param program the commander program
 */
export function registerSet(program: Command): void {
    program
        .command('set <key> [value...]')
        .summary('Change a setting')
        .description('Write one setting to gspot.toml and apply it')
        .addHelpText(
            'after',
            '\nEffects:\nChecks the value, writes it to gspot.toml, and applies the configuration. The key is the dotted name gspot list settings prints. A list value adds to the list unless you pass --replace or --remove. set installs no tools: run gspot install for that.\n\nLevels:\nrecommended, the default, checks correctness, security, accessibility, type safety, dependency health, formatting, and declared project contracts. all adds stable conventions for naming, architecture, documentation, API style, and complexity. Neither level turns on experimental or preview rules.\n\nExit codes:\n- 0: the setting was written and applied.\n- 2: the input was invalid, or set could not finish.\n\nExample:\ngspot set level all',
        )
        .option('--reason <text>', 'Say why; required to loosen a setting when require_reasons is true')
        .option('--scope <path>', 'Write the setting in this scope instead of the root')
        .option('--replace', 'Replace the whole list instead of adding to it')
        .option('--remove', 'Remove these items from the list')
        .option('--default', 'Delete the setting so the inherited or default value applies')
        .action(async (key: string, items: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    setCommand({
                        cwd: directoryOf(global),
                        key,
                        items,
                        replace: flags['replace'] === true,
                        remove: flags['remove'] === true,
                        toDefault: flags['default'] === true,
                        ...textEntry(flags, 'reason', 'reason'),
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}
