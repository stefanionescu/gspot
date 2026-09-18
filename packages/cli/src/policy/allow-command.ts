// gspot allow: the seven allow lists, each with the key it writes and the shape of one entry.
import { PolicyError } from '#cli/policy/read.ts';
import type { CommandResult } from '#types/run.ts';
import type { Raw, Mutation } from '#types/config.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { appendList, tableAt } from '#cli/policy/write.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { AllowList, AllowOptions } from '#types/commands.ts';
import { commit, refuseBadReason, requireReason } from '#cli/policy/commands.ts';

const paths = (entry: unknown): string[] => (entry as Raw)['paths'] as string[];
const field = (name: string) => (entry: unknown, value: string) => (entry as Raw)[name] === value;

const ALLOW_LISTS: Record<string, AllowList> = {
    typos: {
        key: 'tools.typos.words',
        isReasonRequired: false,
        shape: (items, reason) => items.map((word) => ({ word, reason: reason ?? word })),
        matches: field('word'),
    },
    'typos-exclude': {
        key: 'tools.typos.exclude',
        isReasonRequired: true,
        shape: (items, reason) => [{ paths: items, reason }],
        matches: (entry, value) => paths(entry).includes(value),
    },
    licenses: {
        key: 'tools.licenses.exceptions',
        isReasonRequired: true,
        shape: (items, reason, extra) =>
            items.map((name) => ({ package: name, license: extra['license'] ?? 'UNKNOWN', reason })),
        matches: field('package'),
    },
    naming: {
        key: 'naming.allowed',
        isReasonRequired: true,
        shape: (items, reason) => items.map((name) => ({ name, reason })),
        matches: field('name'),
    },
    'naming-external': {
        key: 'naming.external',
        isReasonRequired: false,
        shape: (items) => items,
        matches: (entry, value) => entry === value,
    },
    gitleaks: {
        key: 'tools.gitleaks.allow',
        isReasonRequired: true,
        shape: (items, reason) => [{ description: reason, paths: items, regexes: [], reason }],
        matches: (entry, value) => paths(entry).includes(value),
    },
    osv: {
        key: 'tools.osv.ignore',
        isReasonRequired: true,
        shape: (items, reason) => items.map((id) => ({ id, reason })),
        matches: field('id'),
    },
};

function listSpec(name: string): AllowList {
    const spec = ALLOW_LISTS[name];
    if (spec) return spec;
    const names = Object.keys(ALLOW_LISTS)
        .map((entry) => `\`${entry}\``)
        .join(', ');
    throw new PolicyError([`\`${name}\` is not an allow list. The lists are ${names}.`]);
}

function removeEntries(spec: AllowList, items: string[]): Mutation {
    return (raw) => {
        const parts = spec.key.split('.');
        const name = parts.pop() ?? '';
        const holder = tableAt(raw, parts, false);
        const list = holder?.[name];
        if (!holder || !Array.isArray(list)) return;
        holder[name] = list.filter((entry) => items.every((value) => !spec.matches(entry, value)));
    };
}

/**
 * gspot allow: appends items to one allow list, or removes the entries that name them.
 * @param o the parsed flags
 * @returns the command result
 */
export async function allowCommand(o: AllowOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const spec = listSpec(o.list);
    if (o.remove)
        return commit(root, removeEntries(spec, o.items), o.isDryRun, `removed ${o.items.join(', ')} from ${spec.key}`);
    const where = `gspot allow ${o.list}`;
    if (spec.isReasonRequired) requireReason(o.reason, where, `${where} ${o.items.join(' ')} --reason "..."`);
    else refuseBadReason(o.reason, where);
    const entries = spec.shape(o.items, o.reason, o.license === undefined ? {} : { license: o.license });
    const shown = entries.map((entry) => JSON.stringify(entry)).join(', ');
    return commit(root, appendList(spec.key, entries), o.isDryRun, `${spec.key} += ${shown}`);
}
