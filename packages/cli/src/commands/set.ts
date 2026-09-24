import type { Command } from 'commander';
import { parse as parseToml } from 'smol-toml';
import { openSession } from '#cli/run/session.ts';
import * as messages from '#cli/policy/messages.ts';
import type { Mutation } from '#cli/policy/write.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { isLoosening } from '#cli/policy/loosening.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';
import { settingValue, specFor } from '#cli/policy/settings.ts';
import type { SettingSpec } from '#cli/configurations/schema.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import type { ScopeSelection, Session } from '#cli/run/session.ts';
// gspot set: one setting at a time, checked against the surface, with a reason when the change loosens.
import { commitPolicy, refuseBadReason, requireReason } from '#cli/policy/commit-policy.ts';
import { appendList, deleteKey, removeFromList, scopeHolder, setKey } from '#cli/policy/write.ts';

type SetOptions = {
    cwd: string;
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
};

const NEAR_LIMIT = 12;
const RULE_KEY_DEPTH = 3;
const INTEGER = /^-?\d+$/u;
const DECIMAL = /^-?\d+\.\d+$/u;
// A value that opens with a bracket is meant as a list or a table, whether or not it closes.
const STRUCTURED = /^[[{]/u;

// A value in brackets is a list or a table, written as JSON or the way gspot.toml writes it.
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
        throw new PolicyError([messages.unreadableValue(text)]);
    }
}

function parseValue(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (INTEGER.test(text) || DECIMAL.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function unknownSetting(session: Session, selection: ScopeSelection, key: string): PolicyError {
    // A setting of a configuration that lives in a scope is set in that scope; say which one.
    const holder = session.scopes.find((entry) => specFor(entry.surface, key) !== undefined);
    if (holder !== undefined) return new PolicyError([messages.settingInScope(key, holder.scope.path)]);
    const depth = key.startsWith('tools.') ? 2 : 1;
    const prefix = key.split('.').slice(0, depth).join('.');
    const all = selection.surface.specs.keys().toArray();
    const known = all.filter((entry) => entry.startsWith(`${prefix}.`)).map((entry) => entry.slice(prefix.length + 1));
    return new PolicyError([messages.settingNotExposed(key, known.length > 0 ? known : all.slice(0, NEAR_LIMIT))]);
}

function shaped(parsed: unknown[], isList: boolean): unknown {
    if (parsed.length !== 1) return parsed;
    const [only] = parsed;
    if (!isList) return only;
    return Array.isArray(only) ? (only as unknown[]) : parsed;
}

// A list item that is a table carries its own reason; one sentence there is what a loosening list asks for.
function hasOwnReasons(value: unknown): boolean {
    const items = Array.isArray(value) ? (value as unknown[]) : [];
    return items.length > 0 && items.every((item) => typeof (item as { reason?: unknown } | null)?.reason === 'string');
}

// The reason given on the command line goes into every table item that has none.
function reasonsFilled(value: unknown, reason: string | undefined): unknown {
    if (reason === undefined || !Array.isArray(value)) return value;
    return (value as unknown[]).map((item) =>
        item !== null && typeof item === 'object' && !('reason' in item) ? { ...item, reason } : item,
    );
}

function isReasonOwed(spec: SettingSpec, o: SetOptions, value: unknown, shipped: unknown): boolean {
    if (spec.kind === 'list' && o.remove && spec.direction === 'loosening') return false;
    if (spec.kind === 'list' && !o.remove && hasOwnReasons(value)) return false;
    const isListEdit = spec.kind === 'list' && (o.remove || o.replace);
    if (isListEdit) return spec.direction !== 'neutral';
    return isLoosening(spec, value, shipped);
}

function setMutation(o: SetOptions, isList: boolean, value: unknown): Mutation {
    const written = !isList && o.reason !== undefined ? { value, reason: o.reason } : value;
    return (raw) => {
        const holder = scopeHolder(raw, o.scope);
        if (
            (o.key === 'generated' || o.key === 'vendored') &&
            o.remove &&
            Array.isArray(value) &&
            value.every((item) => typeof item === 'string')
        ) {
            const entries = (holder[o.key] ?? []) as { paths: string[]; reason?: string; produced_by?: string }[];
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
    const tool = o.key.split('.', 2)[1] ?? '';
    const rule = o.key.split('.').slice(RULE_KEY_DEPTH).join('.');
    throw new PolicyError([messages.ruleOffRefused(`<the check that runs ${tool}>`, rule)]);
}

function selectionFor(session: Session, scope: string | undefined): ScopeSelection {
    const selection = session.scopes.find((entry) => entry.scope.path === (scope ?? '')) ?? session.scopes[0];
    if (!selection) throw new PolicyError([messages.scopeMissing(scope ?? '')]);
    return selection;
}

function writeValue(
    root: string,
    session: Session,
    selection: ScopeSelection,
    o: SetOptions,
    spec: SettingSpec,
): Promise<CommandResult> {
    if (o.items.length === 0)
        throw new PolicyError([`gspot set ${o.key} needs a value, or --default to remove yours.`]);
    const isList = spec.kind === 'list';
    const parsed = shaped(
        o.items.map((text) => parseValue(text)),
        isList,
    );
    const isDeclaration = o.key === 'generated' || o.key === 'vendored';
    const paths = isDeclaration && Array.isArray(parsed) && parsed.every((item) => typeof item === 'string');
    const value = reasonsFilled(paths && !o.remove ? [{ paths: parsed }] : parsed, isList ? o.reason : undefined);
    const shipped = selection.surface.defaults.get(spec.name)?.value;
    const where = `gspot set ${o.key}`;
    if (session.policyFiles.policy.requireReasons && isReasonOwed(spec, o, value, shipped))
        requireReason(
            o.reason,
            where,
            `gspot set ${quoteArgument(o.key)} ${o.items.map(quoteArgument).join(' ')}${o.scope === undefined ? '' : ` --scope ${quoteArgument(o.scope)}`}${o.replace ? ' --replace' : ''}${o.remove ? ' --remove' : ''} --reason "..."`,
        );
    else if (session.policyFiles.policy.requireReasons) refuseBadReason(o.reason, where);
    const shown = o.scope === undefined ? o.key : `scope.${o.scope}.${o.key}`;
    return commitPolicy(root, setMutation(o, isList, value), false, describeSet(session, selection, o, shown, value));
}

/**
 * gspot set: writes one setting, appends to or edits a list, or deletes the key with --default.
 * @param o the parsed flags
 * @returns the command result
 */
export async function setCommand(o: SetOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    const selection = selectionFor(session, o.scope);
    const match = specFor(selection.surface, o.key);
    if (!match) throw unknownSetting(session, selection, o.key);
    refuseRuleOff(match.spec, o);
    if (!o.toDefault) return writeValue(root, session, selection, o, match.spec);
    const shown = o.scope === undefined ? o.key : `scope.${o.scope}.${o.key}`;
    const mutation: Mutation = (raw) => {
        deleteKey(o.key)(scopeHolder(raw, o.scope));
    };
    return commitPolicy(root, mutation, false, `${shown} back to the shipped default`);
}

/**
 * Registers set.
 * @param program the commander program
 */
export function registerSet(program: Command): void {
    program
        .command('set <key> [value...]')
        .summary('Change a setting')
        .description('Write one setting; the key is the dotted path gspot list settings prints')
        .addHelpText(
            'after',
            '\nEffects:\nValidates and writes the setting to gspot.toml, then applies generated configuration. --scope writes to an existing scope. Lists append by default; --replace replaces the written list and --remove removes written entries. --default deletes the written key so inherited or shipped values apply. It does not install tools.\n\nExit codes:\n0: the setting change was applied. 2: invalid input or inability to complete the request.\n\nExample:\ngspot set level all',
        )
        .option('--reason <text>', 'Optional explanation; require_reasons makes it required for loosening changes')
        .option('--scope <path>', 'Write into a scope table instead of the root')
        .option('--replace', 'For a list: replace the whole list')
        .option('--remove', 'For a list: remove the named items')
        .option('--default', 'Delete the written key so inherited or shipped values apply')
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
