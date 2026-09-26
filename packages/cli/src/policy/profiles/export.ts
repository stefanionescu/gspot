// gspot export: the policy of this repository without anything that names a path.
import { basename } from 'node:path';
import { stringify, parse as parseToml } from 'smol-toml';
import { isRepositoryPath } from '#cli/policy/profiles/schema.ts';
import type { ExportedProfile } from '#cli/types/policy/profiles.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import { PROFILE_EXTENSION, REPOSITORY_TABLES } from '#cli/constants/policy/profiles.ts';

function isTable(value: unknown): value is TomlTable {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPath(value: unknown): boolean {
    if (!isTable(value)) return false;
    if (Object.entries(value).some(([key, entry]) => isRepositoryPath(key, entry))) return true;
    return Object.values(value).some((entry) => isTable(entry) && hasPath(entry));
}

// Returns the value without the list entries that name a path, and records where each one was.
function withoutPaths(value: unknown, where: string, leftOut: string[]): unknown {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => {
            const entry = `${where}[${String(index)}]`;
            if (hasPath(item)) {
                leftOut.push(`${entry}: names a repository path`);
                return [];
            }
            return [withoutPaths(item, entry, leftOut)];
        });
    }
    if (!isTable(value)) return value;
    const entries = Object.entries(value)
        .filter(([key, inner]) => {
            if (!isRepositoryPath(key, inner)) return true;
            const location = where === '' ? key : `${where}.${key}`;
            leftOut.push(`${location}: names a repository path`);
            return false;
        })
        .map(([key, inner]): [string, unknown] => [
            key,
            withoutPaths(inner, where === '' ? key : `${where}.${key}`, leftOut),
        ])
        .filter(
            ([, inner]) =>
                !(Array.isArray(inner) && inner.length === 0) && !(isTable(inner) && Object.keys(inner).length === 0),
        );
    return Object.fromEntries(entries);
}

/**
 * The profile text for a policy text: the repository tables and every entry that names a path are left out.
 * @param policyText the text of gspot.toml
 * @param file the file the profile is written to, which names it
 * @returns the profile text and what was left out
 */
export function exportedProfile(policyText: string, file: string): ExportedProfile {
    const raw = parseToml(policyText) as TomlTable;
    const leftOut: string[] = [];
    for (const table of REPOSITORY_TABLES) {
        const entries = raw[table];
        if (Array.isArray(entries))
            for (const index of entries.keys()) leftOut.push(`${table}[${String(index)}]: belongs to this repository`);
        Reflect.deleteProperty(raw, table);
    }
    const { version, configurations, ...rest } = withoutPaths(raw, '', leftOut) as TomlTable;
    const name = basename(file).replace(PROFILE_EXTENSION, '');
    const document = { version, profile: name, selection: 'exact', configurations: configurations ?? [], ...rest };
    return { text: stringify(document).trimEnd().concat('\n'), leftOut };
}
