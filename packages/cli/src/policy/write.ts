// The one writer the six commands share: patch gspot.toml keeping comments and order, validate as load does, write.
import { readFileSync, writeFileSync } from 'node:fs';

import { patch } from '@decimalturn/toml-patch';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

import { parsePolicyText, policyPath } from '#cli/policy/load.ts';
import { assertPolicyComplete } from '#cli/policy/validate.ts';
import type { Policy } from '#types/config.ts';

type Raw = Record<string, unknown>;

export type Mutation = (raw: Raw) => void;

export type WriteResult = { text: string; policy: Policy; changed: boolean };

function pathTable(raw: Raw, path: string[], create: boolean): Raw | undefined {
    let current: Raw = raw;
    for (const part of path) {
        let next = current[part];
        if (next === undefined) {
            if (!create) return undefined;
            next = {};
            current[part] = next;
        }
        if (typeof next !== 'object' || next === null || Array.isArray(next)) return undefined;
        current = next as Raw;
    }
    return current;
}

/** Applies a mutation to the raw document and returns the new text and policy; writes when `dryRun` is false. */
export function writePolicy(root: string, mutate: Mutation, dryRun = false): WriteResult {
    const path = policyPath(root);
    const text = readFileSync(path, 'utf8');
    const raw = parseToml(text) as Raw;
    const before = new Set(Object.keys(raw));
    mutate(raw);
    let seed = text;
    for (const [key, value] of Object.entries(raw)) {
        if (before.has(key) || !Array.isArray(value) || value.length === 0 || typeof value[0] !== 'object') continue;
        seed = `${seed.replace(/\n*$/, '\n\n')}${stringifyToml({ [key]: value })}`;
    }
    const next = patch(seed, raw, { inlineTableStart: 2 });
    const policy = parsePolicyText(next, 'gspot.toml', root);
    assertPolicyComplete(policy);
    const changed = next !== text;
    if (changed && !dryRun) writeFileSync(path, next);
    return { text: next, policy, changed };
}

/** Appends an entry to an array of tables such as [[ignore]]. */
export function appendEntry(table: string, entry: Raw): Mutation {
    return (raw) => {
        const list = (raw[table] as Raw[] | undefined) ?? [];
        list.push(entry);
        raw[table] = list;
    };
}

/** Removes every entry of an array of tables that the predicate matches. Returns how many through the counter. */
export function removeEntries(
    table: string,
    predicate: (entry: Raw) => boolean,
    counter: { removed: number },
): Mutation {
    return (raw) => {
        const list = (raw[table] as Raw[] | undefined) ?? [];
        const kept = list.filter((entry) => !predicate(entry));
        counter.removed = list.length - kept.length;
        if (kept.length === 0) delete raw[table];
        else raw[table] = kept;
    };
}

/** Sets a dotted key to a value, creating tables on the way. */
export function setKey(key: string, value: unknown): Mutation {
    return (raw) => {
        const parts = key.split('.');
        const table = pathTable(raw, parts.slice(0, -1), true);
        if (!table) throw new Error(`\`${key}\` runs through a value that is not a table.`);
        table[parts[parts.length - 1]!] = value;
    };
}

/** Deletes a dotted key; empty tables left behind are removed too. */
export function deleteKey(key: string): Mutation {
    return (raw) => {
        const parts = key.split('.');
        const tables: Raw[] = [raw];
        for (const part of parts.slice(0, -1)) {
            const next = tables[tables.length - 1]![part];
            if (typeof next !== 'object' || next === null) return;
            tables.push(next as Raw);
        }
        delete tables[tables.length - 1]![parts[parts.length - 1]!];
        for (let i = tables.length - 1; i > 0; i -= 1) {
            if (Object.keys(tables[i]!).length === 0) delete tables[i - 1]![parts[i - 1]!];
        }
    };
}

/** Appends values to a list key, deduplicated, creating the list. */
export function appendList(key: string, values: unknown[]): Mutation {
    return (raw) => {
        const parts = key.split('.');
        const table = pathTable(raw, parts.slice(0, -1), true)!;
        const name = parts[parts.length - 1]!;
        const existing = table[name];
        const list = Array.isArray(existing) ? [...existing] : [];
        for (const value of values)
            if (!list.some((item) => JSON.stringify(item) === JSON.stringify(value))) list.push(value);
        table[name] = list;
    };
}

/** Removes values from a list key. */
export function removeFromList(key: string, values: unknown[]): Mutation {
    return (raw) => {
        const parts = key.split('.');
        const table = pathTable(raw, parts.slice(0, -1), false);
        if (!table) return;
        const name = parts[parts.length - 1]!;
        const existing = table[name];
        if (!Array.isArray(existing)) return;
        const gone = new Set(values.map((value) => JSON.stringify(value)));
        table[name] = existing.filter(
            (item) =>
                !gone.has(
                    JSON.stringify(
                        typeof item === 'object' && item !== null && 'name' in item ? (item as Raw)['name'] : item,
                    ),
                ) && !gone.has(JSON.stringify(item)),
        );
    };
}

/** The raw value at a dotted key, for commands that print what they changed. */
export function rawValue(root: string, key: string): unknown {
    const raw = parseToml(readFileSync(policyPath(root), 'utf8')) as Raw;
    let current: unknown = raw;
    for (const part of key.split('.')) {
        if (typeof current !== 'object' || current === null) return undefined;
        current = (current as Raw)[part];
    }
    return current;
}
