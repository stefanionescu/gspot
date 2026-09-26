// The setting keys a policy table writes, spelled the way the surface exposes them.
import { asRecord } from '#cli/policy/settings.ts';
import type { ExposedSettings, NamingCategoryTable, Policy } from '#cli/types/policy/policy.ts';

const NAMING_SCALARS = ['max_chars', 'max_words', 'case'] as const;

function limitKeys(policy: Partial<Policy>): string[] {
    if (!policy.limits) return [];
    const keys = Object.keys(policy.limits.root).map((key) => `limits.${key}`);
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const key of Object.keys(table)) keys.push(`limits.${group}.${key}`);
    return keys;
}

function scalarKeys(prefix: string, table: NamingCategoryTable): string[] {
    return NAMING_SCALARS.filter((key) => table[key] !== undefined).map((key) => `${prefix}.${key}`);
}

function namingKeys(policy: Partial<Policy>): string[] {
    if (!policy.naming) return [];
    const keys: string[] = [];
    for (const [language, table] of Object.entries(policy.naming.languages)) {
        keys.push(...scalarKeys(`naming.${language}`, table));
        for (const [category, inner] of Object.entries(table.categories))
            keys.push(...scalarKeys(`naming.${language}.${category}`, inner));
    }
    return keys;
}

// Whether a written tool table is a group of exposed keys rather than one exposed key.
function isKeyGroup(surface: ExposedSettings, key: string, value: unknown): value is Record<string, unknown> {
    if (surface.specs.has(key) || Array.isArray(value) || asRecord(value) === undefined) return false;
    return [...surface.specs.keys()].some((name) => name.startsWith(`${key}.`));
}

function toolKeys(policy: Partial<Policy>, surface: ExposedSettings): string[] {
    const keys: string[] = [];
    const pending = Object.entries(policy.tools ?? {}).flatMap(([tool, table]) =>
        Object.entries(table)
            .filter(([slot]) => slot !== 'extra')
            .map(([slot, value]) => ({ key: `tools.${tool}.${slot}`, value })),
    );
    for (const { key, value } of pending) {
        if (isKeyGroup(surface, key, value))
            pending.push(...Object.entries(value).map(([slot, child]) => ({ key: `${key}.${slot}`, value: child })));
        else keys.push(key);
    }
    return keys;
}

/**
 * Every setting key a policy table writes, in dotted form.
 * @param policy the root table or one scope table
 * @param surface the selected manifest settings, including nested tool keys
 * @returns the keys under limits, naming, tools and format
 */
export function writtenKeys(policy: Partial<Policy>, surface: ExposedSettings): string[] {
    const format = Object.keys(policy.format ?? {}).map((key) => `format.${key}`);
    return [...limitKeys(policy), ...namingKeys(policy), ...toolKeys(policy, surface), ...format];
}
