import semver from 'semver';
import { z } from 'zod';
import { deleteKey, setKey, tableAt, proposePolicy } from '#cli/policy/write.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import type { PolicyRename } from '#types/lifecycle.ts';
import type { TomlTable, WriteResult } from '#types/config.ts';

const key = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/u);
export const renameSchema = z
    .strictObject({
        version: z.string().refine((value) => semver.valid(value) !== null),
        old_key: key,
        new_key: key,
    })
    .refine(
        (row) =>
            row.old_key !== row.new_key &&
            !row.old_key.startsWith(`${row.new_key}.`) &&
            !row.new_key.startsWith(`${row.old_key}.`),
        'Migration paths must not overlap.',
    );

// The first release has no compatibility names. Later releases add ordered rows here.
export const RENAMES: readonly PolicyRename[] = [];

/** Rewrite old TOML in memory before validating it against the target schema. */
export function migratePolicy(
    root: string,
    text: string,
    from: string | undefined,
    target: string,
    rows: readonly PolicyRename[] = RENAMES,
): WriteResult & { rewrites: string[] } {
    if (semver.valid(target) === null || (from !== undefined && semver.valid(from) === null))
        throw new PolicyError(['Upgrade requires exact version pins.']);
    if (from !== undefined && semver.gt(from, target))
        throw new PolicyError([
            'No reverse migration is available. Restore the previous complete configuration, generated files, locks, and pin together.',
        ]);
    const selected = z
        .array(renameSchema)
        .parse(rows)
        .filter((row) => from !== undefined && semver.gt(row.version, from) && semver.lte(row.version, target))
        .toSorted((a, b) => semver.compare(a.version, b.version));
    const rewrites: string[] = [];
    const proposal = proposePolicy(root, text, (raw) => {
        const scopes = Array.isArray(raw['scope'])
            ? z.array(z.record(z.string(), z.unknown())).parse(raw['scope'])
            : [];
        const holders: { table: TomlTable; label: string }[] = [
            { table: raw, label: '' },
            ...scopes.map((table, index) => ({ table, label: `scope[${index}].` })),
        ];
        for (const row of selected) {
            for (const holder of holders) {
                const parts = row.old_key.split('.');
                const name = parts.pop()!;
                const old = tableAt(holder.table, parts, false);
                if (old === undefined || !Object.hasOwn(old, name)) continue;
                const destination = row.new_key.split('.');
                const destinationName = destination.pop()!;
                const existing = tableAt(holder.table, destination, false);
                if (existing !== undefined && Object.hasOwn(existing, destinationName))
                    throw new PolicyError([
                        `Cannot migrate ${holder.label}${row.old_key}: ${holder.label}${row.new_key} already exists. Preserve both values and resolve the conflict.`,
                    ]);
                setKey(row.new_key, old[name])(holder.table);
                deleteKey(row.old_key)(holder.table);
                rewrites.push(`${holder.label}${row.old_key} -> ${holder.label}${row.new_key}`);
            }
        }
        if (Array.isArray(raw['scope'])) raw['scope'] = scopes;
    });
    return { ...proposal, rewrites };
}
