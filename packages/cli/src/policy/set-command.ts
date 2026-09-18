import { openSession } from '#cli/run/session.ts';
import * as messages from '#cli/policy/messages.ts';
import type { SetOptions } from '#types/commands.ts';
import type { SettingSpec } from '#types/manifest.ts';
import { findRoot } from '#cli/repository/tracked.ts';
// gspot set: one setting at a time, checked against the surface, with a reason when the change loosens.
import { PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { TomlTable, Mutation } from '#types/config.ts';
import { specFor, settingValue } from '#cli/policy/settings.ts';
import type { CommandResult, ScopeSelection, Session } from '#types/run.ts';
import { appendList, deleteKey, removeFromList, setKey } from '#cli/policy/write.ts';
import { commitPolicy, refuseBadReason, requireReason } from '#cli/policy/commit-policy.ts';

const NEAR_LIMIT = 12;
const RULE_KEY_DEPTH = 3;
const INTEGER = /^-?\d+$/u;
const DECIMAL = /^-?\d+\.\d+$/u;
const STRUCTURED = /^(?:\[.*\]|\{.*\})$/su;

function parseStructured(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function parseValue(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (INTEGER.test(text) || DECIMAL.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function unknownSetting(selection: ScopeSelection, key: string): PolicyError {
    const depth = key.startsWith('tools.') ? 2 : 1;
    const prefix = key.split('.').slice(0, depth).join('.');
    const all = selection.surface.specs.keys().toArray();
    const known = all.filter((entry) => entry.startsWith(`${prefix}.`)).map((entry) => entry.slice(prefix.length + 1));
    return new PolicyError([messages.settingNotExposed(key, known.length > 0 ? known : all.slice(0, NEAR_LIMIT))]);
}

function holderFor(raw: TomlTable, scope: string | undefined): TomlTable {
    if (scope === undefined) return raw;
    const scopes = (raw['scope'] as TomlTable[] | undefined) ?? [];
    const holder = scopes.find((entry) => entry['path'] === scope);
    if (!holder) throw new PolicyError([messages.scopeMissing(scope)]);
    return holder;
}

function shaped(parsed: unknown[], isList: boolean): unknown {
    if (parsed.length !== 1) return parsed;
    const [only] = parsed;
    if (!isList) return only;
    return Array.isArray(only) ? (only as unknown[]) : parsed;
}

function isNumberLoosening(spec: SettingSpec, value: unknown, shipped: unknown): boolean {
    if (typeof value !== 'number' || typeof shipped !== 'number') return false;
    if (spec.direction === 'ceiling') return value > shipped;
    return spec.direction === 'floor' && value < shipped;
}

function isLoosening(spec: SettingSpec, o: SetOptions, value: unknown, shipped: unknown): boolean {
    if (spec.direction === 'loosening') return true;
    const isListEdit = spec.kind === 'list' && (o.remove || o.replace);
    if (isListEdit) return spec.direction !== 'neutral';
    return isNumberLoosening(spec, value, shipped);
}

function setMutation(o: SetOptions, isList: boolean, value: unknown): Mutation {
    const written = !isList && o.reason !== undefined ? { value, reason: o.reason } : value;
    return (raw) => {
        const holder = holderFor(raw, o.scope);
        if (isList && o.remove) removeFromList(o.key, value as unknown[])(holder);
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
    const value = shaped(
        o.items.map((text) => parseValue(text)),
        isList,
    );
    const shipped = selection.surface.defaults.get(spec.name)?.value;
    const where = `gspot set ${o.key}`;
    if (isLoosening(spec, o, value, shipped))
        requireReason(o.reason, where, `${where} ${o.items.join(' ')} --reason "..."`);
    else refuseBadReason(o.reason, where);
    const shown = o.scope === undefined ? o.key : `scope.${o.scope}.${o.key}`;
    return commitPolicy(
        root,
        setMutation(o, isList, value),
        o.isDryRun,
        describeSet(session, selection, o, shown, value),
    );
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
    if (!match) throw unknownSetting(selection, o.key);
    refuseRuleOff(match.spec, o);
    if (!o.toDefault) return writeValue(root, session, selection, o, match.spec);
    const shown = o.scope === undefined ? o.key : `scope.${o.scope}.${o.key}`;
    const mutation: Mutation = (raw) => {
        deleteKey(o.key)(holderFor(raw, o.scope));
    };
    return commitPolicy(root, mutation, o.isDryRun, `${shown} back to the shipped default`);
}
